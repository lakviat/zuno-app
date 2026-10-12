import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSeed } from '../../mocks/seed';
import { SocialMap } from './SocialMap';
import { MIAMI, type SocialMapProps } from './types';

const m = vi.hoisted(() => ({
  nativeMap: {
    // Simulate everyone projecting into the same pixel at world scale.
    pointForCoordinate: vi.fn(async () => ({ x: 100, y: 100 })),
    coordinateForPoint: vi.fn(async () => ({ latitude: 25.7885, longitude: -80.141 })),
  },
}));
vi.mock('react-native-maps', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef(function MockMapView(props: { children: React.ReactNode }, ref) {
      React.useImperativeHandle(ref, () => m.nativeMap);
      return React.createElement('MapView', props, props.children);
    }),
    Marker: Object.assign('Marker', { Animated: 'AnimatedMarker' }),
    Polyline: 'Polyline',
  };
});
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  View: 'View',
  StyleSheet: { absoluteFill: {} },
  useWindowDimensions: () => ({ width: 393, height: 852 }),
  Animated: {
    Value: class {
      constructor(public value: number) {}
      setValue(value: number) {
        this.value = value;
      }
      stopAnimation() {}
    },
  },
}));
vi.mock('../../state/AppContext', () => ({ useTheme: () => ({ colors: { surface: '#fff' } }) }));
vi.mock('../../components/ui', () => ({ Txt: 'Text' }));
vi.mock('./MapMarker', () => ({
  FriendMarker: 'FriendMarker',
  MeetupMarker: 'MeetupMarker',
  MeetupClusterMarker: 'MeetupClusterMarker',
}));
vi.mock('../location/store', () => ({ useMotion: () => undefined }));
vi.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

let tree: ReactTestRenderer;
let props: SocialMapProps;
const pins = () => tree.root.findAllByType('AnimatedMarker' as React.ElementType);
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const state = createSeed();
  props = {
    people: state.people.slice(1),
    me: state.people[0],
    meetups: [],
    now: Date.now(),
    dark: false,
    onPersonPress: vi.fn(),
    onMeetupPress: vi.fn(),
    onMeetupClusterPress: vi.fn(),
  };
  await act(async () => {
    tree = create(<SocialMap {...props} />);
  });
  await act(async () => {
    tree.root.findByType('MapView' as React.ElementType).props.onMapReady();
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('keeps every avatar on its coordinate during zoom, reversal and panning, with no spread or connector lines', async () => {
  const original = pins().map((pin) => pin.props.coordinate);
  const locations = [...props.people, props.me]
    .filter((p) => p.location)
    .map((p) => p.location!.coordinate);
  for (const span of [0.06, 4, 90, 4, 0.06]) {
    await act(async () => {
      const map = tree.root.findByType('MapView' as React.ElementType);
      map.props.onRegionChangeStart();
      map.props.onRegionChangeComplete({
        ...MIAMI,
        longitude: -81,
        latitudeDelta: span,
        longitudeDelta: span,
      });
      vi.advanceTimersByTime(200);
    });
    expect(pins()).toHaveLength(locations.length);
    pins().forEach((pin, i) => {
      expect(pin.props.coordinate).toBe(original[i]);
      expect(pin.props.coordinate.latitude.value).toBe(locations[i].latitude);
      expect(pin.props.coordinate.longitude.value).toBe(locations[i].longitude);
      expect(pin.props.centerOffset).toBeUndefined();
      expect(pin.props.displayPriority).toBe('required');
    });
    expect(tree.root.findAllByType('Polyline' as React.ElementType)).toHaveLength(0);
  }
});

it('moves a marker when new authorized location data arrives, not when its status changes', async () => {
  const first = props.people[0];
  const coordinate = pins()[0].props.coordinate;
  props = {
    ...props,
    people: props.people.map((p) =>
      p === first ? { ...p, presence: { ...p.presence, intent: '🏋️ Gym' } } : p,
    ),
  };
  await act(async () => {
    tree.update(<SocialMap {...props} />);
  });
  expect(coordinate.latitude.value).toBe(first.location!.coordinate.latitude);
  const moved = { latitude: 26, longitude: -81 };
  props = {
    ...props,
    people: props.people.map((p) =>
      p.user.id === first.user.id ? { ...p, location: { ...p.location!, coordinate: moved } } : p,
    ),
  };
  await act(async () => {
    tree.update(<SocialMap {...props} />);
  });
  expect(pins()[0].props.coordinate).toBe(coordinate);
  expect(coordinate.latitude.value).toBe(moved.latitude);
  expect(coordinate.longitude.value).toBe(moved.longitude);
});
