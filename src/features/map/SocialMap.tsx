import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import MapView, { Marker, type Region } from 'react-native-maps';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Txt } from '../../components/ui';
import { useTheme } from '../../state/AppContext';
import { MeetupMarker, MeetupClusterMarker } from './MapMarker';
import { NativePersonMarker } from './NativePersonMarker';
import { longitudeOffset } from '../../utils/geo';
import { MIN_ZOOM, MAX_ZOOM } from './zoom';
import { createNativeCamera } from './nativeCamera';
import { APPLE_MIN_ALTITUDE, APPLE_MAX_ALTITUDE } from './appleCamera';
import { clusterMeetups } from './meetupClusters';
import { MIAMI, type MapHandle, type SocialMapProps } from './types';

export const SocialMap = React.memo(
  forwardRef<MapHandle, SocialMapProps>(function SocialMap(props, ref) {
    const map = useRef<MapView>(null);
    const { width, height } = useWindowDimensions();
    const { colors } = useTheme();
    const [mapReady, setMapReady] = useState(false);
    const settledTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const callbacks = useRef(props);
    useLayoutEffect(() => {
      callbacks.current = props;
    });
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
    const nativeMoving = useRef(false);
    const zoom = useMemo(
      () =>
        createNativeCamera({
          apple: Platform.OS === 'ios',
          read: async () => {
            if (!map.current) throw new Error('Map not ready');
            return map.current.getCamera();
          },
          apply: (camera) => map.current?.setCamera(camera),
        }),
      [],
    );
    useEffect(
      () => () => {
        zoom.dispose();
        clearTimeout(settledTimer.current);
      },
      [zoom],
    );
    const publishSettled = useCallback(() => {
      clearTimeout(settledTimer.current);
      settledTimer.current = setTimeout(() => {
        if (zoom.isActive()) return;
        setRegion({ ...regionRef.current });
        callbacks.current.onViewportChange?.(regionRef.current);
        zoom.settled();
      }, 180);
    }, [zoom]);
    useImperativeHandle(
      ref,
      () => ({
        recenter(coordinate = MIAMI) {
          zoom.nativeGesture();
          map.current?.animateToRegion(
            { ...coordinate, latitudeDelta: 0.06, longitudeDelta: 0.05 },
            0,
          );
        },
        zoomBy: (delta) => {
          void zoom.step(delta);
        },
        beginZoom: () => {
          clearTimeout(settledTimer.current);
          callbacks.current.onMoving?.();
          zoom.begin();
        },
        updateZoom: zoom.update,
        endZoom: (commit) => {
          zoom.end(commit);
          publishSettled();
        },
      }),
      [zoom, publishSettled],
    );
    const people = useMemo(
      () =>
        [...props.people.filter((p) => p.user.id !== props.me.user.id), props.me].filter(
          (p) => p.location,
        ),
      [props.people, props.me],
    );
    const compactPeople = width < 720 || region.latitudeDelta > 0.1;
    const meetupGroups = useMemo(
      () =>
        clusterMeetups(
          props.meetups.map((meetup) => ({
            meetup,
            x:
              (longitudeOffset(meetup.place.coordinate.longitude, region.longitude) /
                region.longitudeDelta) *
              width,
            y:
              ((region.latitude - meetup.place.coordinate.latitude) / region.latitudeDelta) *
              height,
          })),
          width < 720 ? 70 : 170,
        ),
      [props.meetups, region, width, height],
    );
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#C4DFDD' }]}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          // Apple Maps never emits onMapLoaded; its ready event starts native rendering.
          // Android still waits for tiles so a Google Maps authorization failure stays visible.
          onMapReady={() => {
            if (Platform.OS === 'ios') setMapReady(true);
          }}
          onMapLoaded={() => setMapReady(true)}
          onTouchStart={() => {
            clearTimeout(settledTimer.current);
            zoom.nativeGesture();
            nativeMoving.current = false;
            callbacks.current.onMoving?.();
          }}
          onTouchEnd={() => {
            if (!nativeMoving.current) publishSettled();
          }}
          onTouchCancel={() => {
            if (!nativeMoving.current) publishSettled();
          }}
          onRegionChangeStart={() => {
            nativeMoving.current = true;
            clearTimeout(settledTimer.current);
          }}
          onLongPress={(event) => callbacks.current.onLongPress?.(event.nativeEvent.coordinate)}
          onRegionChangeComplete={(next) => {
            nativeMoving.current = false;
            regionRef.current = next;
            publishSettled();
          }}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          showsPointsOfInterests={false}
          showsBuildings={false}
          showsTraffic={false}
          showsIndoors={false}
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
          userInterfaceStyle="light"
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsCompass={false}
          showsUserLocation={false}
          showsMyLocationButton={false}
          mapPadding={{ top: 85, bottom: 105, left: 12, right: 12 }}
        >
          {people.map((person) => (
            <NativePersonMarker
              now={props.now}
              key={person.user.id}
              person={person}
              selected={person.user.id === props.me.user.id || props.selectedId === person.user.id}
              compact={compactPeople}
              onSelect={props.onPersonPress}
            />
          ))}
          {meetupGroups.map((group) => {
            const multiple = group.meetups.length > 1;
            const onPress = () =>
              multiple
                ? props.onMeetupClusterPress(group.meetups.map((m) => m.id))
                : props.onMeetupPress(group.meetups[0].id);
            return (
              <Marker
                key={group.meetups.map((m) => m.id).join(':')}
                centerOffset={region.latitudeDelta > 0.15 ? { x: 28, y: 22 } : undefined}
                zIndex={3}
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
  }),
);
