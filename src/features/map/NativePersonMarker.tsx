import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Marker } from 'react-native-maps';
import { Animated, Platform } from 'react-native';
import { presencePresentation } from '../presence/presentation';
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
  now,
  onSelect,
}: {
  person: Person;
  compact: boolean;
  selected: boolean;
  now: number;
  onSelect(id: string): void;
}) {
  // Apple custom views update directly. Google markers need a brief bitmap refresh
  // when their artwork changes, not continuous view tracking while idle.
  const display = presencePresentation(person.presence, now);
  const [tracking, setTracking] = useState(Platform.OS !== 'ios');
  useEffect(() => {
    if (Platform.OS === 'ios') return;
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), 750);
    return () => clearTimeout(timer);
  }, [display.emoji, display.status, person.profile.avatar, compact, selected]);
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
      tracksViewChanges={tracking}
      displayPriority="required"
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={selected ? 5 : 4}
      onPress={() => onSelect(person.user.id)}
    >
      <FriendMarker
        now={now}
        person={person}
        compact={compact}
        selected={selected}
        onPress={() => onSelect(person.user.id)}
      />
    </Marker.Animated>
  );
});
