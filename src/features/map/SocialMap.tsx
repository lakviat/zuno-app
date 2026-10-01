import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import MapView, { Marker, type Region } from 'react-native-maps';
import { View, useWindowDimensions } from 'react-native';
import { Avatar, Txt } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { FriendMarker, PlanMarker } from './MapMarker';
import { clusterPeople } from './clusters';
import { MIAMI, type MapHandle, type SocialMapProps } from './types';

export const SocialMap = forwardRef<MapHandle, SocialMapProps>(function SocialMap(props, ref) {
  const map = useRef<MapView>(null);
  const { width, height } = useWindowDimensions();
  const { colors } = useApp();
  const [region, setRegion] = useState<Region>({
    ...MIAMI,
    latitudeDelta: 0.06,
    longitudeDelta: 0.05,
  });
  useImperativeHandle(
    ref,
    () => ({
      recenter(coordinate = MIAMI) {
        map.current?.animateToRegion(
          { ...coordinate, latitudeDelta: 0.06, longitudeDelta: 0.05 },
          450,
        );
      },
      zoomBy(delta) {
        const next = {
          ...region,
          latitudeDelta: Math.max(0.001, Math.min(40, region.latitudeDelta * 2 ** -delta)),
          longitudeDelta: Math.max(0.001, Math.min(40, region.longitudeDelta * 2 ** -delta)),
        };
        setRegion(next);
        map.current?.animateToRegion(next, 80);
      },
    }),
    [region],
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
    <MapView
      ref={map}
      style={{ position: 'absolute', inset: 0 }}
      initialRegion={region}
      onRegionChangeComplete={setRegion}
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
            onPress={() =>
              map.current?.animateToRegion(
                {
                  ...coordinate,
                  latitudeDelta: region.latitudeDelta / 2,
                  longitudeDelta: region.longitudeDelta / 2,
                },
                350,
              )
            }
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
      {props.plans.map((plan) => (
        <Marker
          key={plan.id}
          coordinate={plan.place.coordinate}
          onPress={() => props.onPlanPress(plan.id)}
        >
          <PlanMarker
            compact={width < 720}
            plan={plan}
            onPress={() => props.onPlanPress(plan.id)}
          />
        </Marker>
      ))}
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
  );
});
