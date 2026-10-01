import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import MapView, { Marker, type Region } from 'react-native-maps';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Avatar, Txt } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { FriendMarker, MeetupMarker, MeetupClusterMarker } from './MapMarker';
import { MIN_ZOOM, MAX_ZOOM } from './zoom';
import { createNativeCamera } from './nativeCamera';
import { APPLE_MIN_ALTITUDE, APPLE_MAX_ALTITUDE, globeViewportHeight } from './appleCamera';
import { clusterMeetups } from './meetupClusters';
import { clusterPeople } from './clusters';
import { MIAMI, type MapHandle, type SocialMapProps } from './types';

export const SocialMap = forwardRef<MapHandle, SocialMapProps>(function SocialMap(props, ref) {
  const map = useRef<MapView>(null);
  const { width, height } = useWindowDimensions();
  const { colors } = useApp();
  const [mapReady, setMapReady] = useState(false);
  const [globe, setGlobe] = useState(false);
  const [altitude, setAltitude] = useState(0);
  const viewportHeight = globe ? globeViewportHeight(altitude, width, height) : height;
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, []);
  const [region, setRegion] = useState<Region>({
    ...MIAMI,
    latitudeDelta: 0.06,
    longitudeDelta: 0.05,
  });
  const regionRef = useRef(region);
  const zoom = useMemo(
    () =>
      createNativeCamera({
        apple: Platform.OS === 'ios',
        read: async () => {
          if (!map.current) throw new Error('Map not ready');
          return map.current.getCamera();
        },
        apply: (camera) => map.current?.setCamera(camera),
        onGlobeChange: setGlobe,
        onAltitudeChange: setAltitude,
      }),
    [],
  );
  useEffect(() => () => zoom.dispose(), [zoom]);
  useLayoutEffect(() => zoom.presentationReady(globe), [globe, viewportHeight, zoom]);
  useImperativeHandle(
    ref,
    () => ({
      recenter(coordinate = MIAMI) {
        zoom.nativeGesture();
        // Zero-duration moves cannot continue behind a new thumb gesture.
        map.current?.animateToRegion(
          { ...coordinate, latitudeDelta: 0.06, longitudeDelta: 0.05 },
          0,
        );
      },
      zoomBy: (delta) => {
        void zoom.step(delta);
      },
      beginZoom: zoom.begin,
      updateZoom: zoom.update,
      endZoom: zoom.end,
    }),
    [zoom],
  );
  // The native viewport region provides a local screen approximation for clustering.
  // Provider-specific projection can replace this for globe/pitched views later.
  const clusters = clusterPeople(
    props.people.flatMap((person) => {
      const c = person.location?.coordinate;
      return c
        ? [
            {
              person,
              x: ((c.longitude - region.longitude) / region.longitudeDelta) * width,
              y: ((region.latitude - c.latitude) / region.latitudeDelta) * height,
            },
          ]
        : [];
    }),
  );
  return (
    <View style={[StyleSheet.absoluteFill, globe && { backgroundColor: '#000' }]}>
      <MapView
        ref={map}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: viewportHeight,
          top: (height - viewportHeight) / 2,
        }}
        initialRegion={region}
        // Apple Maps never emits onMapLoaded; its ready event starts native rendering.
        // Android still waits for tiles so a Google Maps authorization failure stays visible.
        onMapReady={() => {
          if (Platform.OS === 'ios') setMapReady(true);
          zoom.ready();
        }}
        onMapLoaded={() => setMapReady(true)}
        onTouchStart={() => zoom.nativeGesture()}
        onRegionChange={(next) => {
          regionRef.current = next;
        }}
        onRegionChangeComplete={(next) => {
          regionRef.current = next;
          if (!zoom.isActive()) setRegion(next);
          zoom.settled();
        }}
        mapType={globe ? 'hybridFlyover' : 'standard'}
        minZoomLevel={Platform.OS === 'ios' ? undefined : MIN_ZOOM}
        maxZoomLevel={Platform.OS === 'ios' ? undefined : MAX_ZOOM}
        cameraZoomRange={
          Platform.OS === 'ios'
            ? {
                minCenterCoordinateDistance: APPLE_MIN_ALTITUDE,
                maxCenterCoordinateDistance: APPLE_MAX_ALTITUDE,
              }
            : undefined
        }
        userInterfaceStyle={props.dark ? 'dark' : 'light'}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsCompass={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        mapPadding={{ top: 85, bottom: 105, left: 12, right: 12 }}
      >
        {clusters.map((cluster) => {
          const person = cluster.people[0].person;
          if (cluster.people.length === 1)
            return (
              <Marker
                key={cluster.id}
                coordinate={person.location!.coordinate}
                tracksViewChanges
                onPress={() => props.onPersonPress(person.user.id)}
              >
                <FriendMarker
                  person={person}
                  selected={props.selectedId === person.user.id}
                  onPress={() => props.onPersonPress(person.user.id)}
                  compact={width < 720 || region.latitudeDelta > 0.1}
                />
              </Marker>
            );
          const coordinate = {
            latitude: region.latitude - (cluster.y / height) * region.latitudeDelta,
            longitude: region.longitude + (cluster.x / width) * region.longitudeDelta,
          };
          return (
            <Marker
              key={cluster.id}
              coordinate={coordinate}
              accessibilityLabel={'Zoom into ' + cluster.people.length + ' friends'}
              onPress={() => {
                zoom.nativeGesture();
                map.current?.animateToRegion(
                  {
                    ...coordinate,
                    latitudeDelta: region.latitudeDelta / 2,
                    longitudeDelta: region.longitudeDelta / 2,
                  },
                  0,
                );
              }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  backgroundColor: colors.surface,
                  borderRadius: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 3,
                  borderColor: colors.accent,
                }}
              >
                <Txt weight="display" style={{ fontSize: 24 }}>
                  {cluster.people.length}
                </Txt>
                <Txt style={{ fontSize: 9 }}>friends</Txt>
              </View>
            </Marker>
          );
        })}
        {clusterMeetups(
          props.meetups.map((meetup) => ({
            meetup,
            x:
              ((meetup.place.coordinate.longitude - region.longitude) / region.longitudeDelta) *
              width,
            y:
              ((region.latitude - meetup.place.coordinate.latitude) / region.latitudeDelta) *
              height,
          })),
          width < 720 ? 70 : 170,
        ).map((group) => {
          const multiple = group.meetups.length > 1;
          const onPress = () =>
            multiple
              ? props.onMeetupClusterPress(group.meetups.map((m) => m.id))
              : props.onMeetupPress(group.meetups[0].id);
          return (
            <Marker
              key={group.meetups.map((m) => m.id).join(':')}
              coordinate={{
                latitude: region.latitude - (group.y / height) * region.latitudeDelta,
                longitude: region.longitude + (group.x / width) * region.longitudeDelta,
              }}
              onPress={onPress}
            >
              {multiple ? (
                <MeetupClusterMarker count={group.meetups.length} onPress={onPress} />
              ) : (
                <MeetupMarker compact={width < 720} meetup={group.meetups[0]} onPress={onPress} />
              )}
            </Marker>
          );
        })}
        {props.me.location && (
          <Marker coordinate={props.me.location.coordinate}>
            <View
              style={{
                padding: 6,
                borderRadius: 40,
                backgroundColor: '#F26B5050',
                borderWidth: 2,
                borderColor: '#F26B50',
              }}
            >
              <Avatar person={props.me} size={32} />
            </View>
          </Marker>
        )}
      </MapView>
      {!mapReady && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: '42%',
            left: 24,
            right: 80,
            padding: 16,
            borderRadius: 18,
            backgroundColor: colors.surface,
          }}
        >
          <Txt style={{ fontSize: 12, lineHeight: 18 }}>
            {slow
              ? 'The map isn’t loading. Your people and meetups are still available below.'
              : 'Finding your little corner of the world…'}
          </Txt>
        </View>
      )}
    </View>
  );
});
