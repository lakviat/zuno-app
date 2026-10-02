import { memo, useEffect, useMemo, useRef } from 'react';
import { Marker } from 'react-native-maps';
import { Animated } from 'react-native';
import { FriendMarker } from './MapMarker';
import { canInterpolate, type LocationSample } from '../location/motion';
import { useMotion } from '../location/store';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { Person } from '../../types/domain';
/** Animated marker coordinates; interpolation never updates React component state. */
export const NativePersonMarker = memo(function NativePersonMarker({
  person,
  compact,
  selected,
  onSelect,
}: {
  person: Person;
  compact: boolean;
  selected: boolean;
  onSelect(id: string): void;
}) {
  const sample = useMotion(person.user.id, person.location?.precision === 'precise');
  const reduced = useReducedMotion();
  const origin = person.location!.coordinate;
  const initial = useRef(origin);
  const coordinate = useMemo(
    () => ({
      latitude: new Animated.Value(initial.current.latitude),
      longitude: new Animated.Value(initial.current.longitude),
    }),
    [],
  );
  const lastSample = useRef<LocationSample | undefined>(undefined);
  useEffect(() => {
    const next = sample?.coordinate ?? { latitude: origin.latitude, longitude: origin.longitude };
    coordinate.latitude.stopAnimation();
    coordinate.longitude.stopAnimation();
    const animate = canInterpolate(lastSample.current, sample);
    lastSample.current = sample;
    if (!animate || reduced) {
      coordinate.latitude.setValue(next.latitude);
      coordinate.longitude.setValue(next.longitude);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(coordinate.latitude, {
        toValue: next.latitude,
        duration: 1200,
        useNativeDriver: false,
      }),
      Animated.timing(coordinate.longitude, {
        toValue: next.longitude,
        duration: 1200,
        useNativeDriver: false,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [coordinate, sample, origin.latitude, origin.longitude, reduced]);
  return (
    <Marker.Animated
      coordinate={coordinate}
      tracksViewChanges={false}
      onPress={() => onSelect(person.user.id)}
    >
      <FriendMarker
        person={person}
        compact={compact}
        selected={selected}
        onPress={() => onSelect(person.user.id)}
      />
    </Marker.Animated>
  );
});
