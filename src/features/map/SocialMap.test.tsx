import React, { createRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSeed } from '../../mocks/seed';
import { SocialMap } from './SocialMap';
import { MIAMI, type MapHandle, type SocialMapProps } from './types';
import { APPLE_MAX_ALTITUDE, APPLE_MIN_ALTITUDE } from './appleCamera';

const m = vi.hoisted(() => ({
  nativeMap: {
    getCamera: vi.fn(),
    setCamera: vi.fn(),
    animateToRegion: vi.fn(),
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
    Marker: Object.assign(
      function MockMarker(props: { children: React.ReactNode }) {
        return React.createElement('Marker', props, props.children);
      },
      { Animated: 'AnimatedMarker' },
    ),
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
let handle: React.RefObject<MapHandle | null>;
const mapView = () => tree.root.findByType('MapView' as React.ElementType);
const pins = () => tree.root.findAllByType('AnimatedMarker' as React.ElementType);
beforeEach(async () => {
  vi.clearAllMocks();
  m.nativeMap.getCamera.mockResolvedValue({
    center: MIAMI,
    altitude: 10_000,
    heading: 0,
    pitch: 0,
  });
  handle = createRef<MapHandle>();
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
    meetupHosts: Object.fromEntries(state.people.map((p) => [p.user.id, p])),
    now: Date.now(),
    dark: false,
    onPersonPress: vi.fn(),
    onMeetupPress: vi.fn(),
    onMeetupClusterPress: vi.fn(),
  };
  await act(async () => {
    tree = create(<SocialMap {...props} ref={handle} />);
  });
  await act(async () => {
    mapView().props.onMapReady();
  });
});

it('fits the whole Earth to the measured map area and restores the bright map on zoom-in without moving avatars', async () => {
  const original = pins().map((pin) => pin.props.coordinate);
  await act(async () => {
    // The phone-test footer and header make the actual map shorter than the window.
    tree.root.findByType('View' as React.ElementType).props.onLayout({
      nativeEvent: { layout: { width: 393, height: 780 } },
    });
    handle.current!.zoomBy(-30);
  });
  expect(mapView().props.mapType).toBe('hybridFlyover');
  expect(mapView().props.style).toMatchObject({ height: 393, top: 193.5 });
  expect(m.nativeMap.setCamera.mock.calls.at(-1)?.[0]).toMatchObject({
    center: MIAMI,
    altitude: APPLE_MAX_ALTITUDE,
  });
  pins().forEach((pin, i) => expect(pin.props.coordinate).toBe(original[i]));
  expect(tree.root.findAllByType('Polyline' as React.ElementType)).toHaveLength(0);

  await act(async () => handle.current!.zoomBy(30));
  expect(mapView().props.mapType).toBe('mutedStandard');
  expect(mapView().props.userInterfaceStyle).toBe('light');
  expect(mapView().props.style).toMatchObject({ height: 780, top: 0 });
  expect(m.nativeMap.setCamera.mock.calls.at(-1)?.[0]).toMatchObject({
    center: MIAMI,
  });
  expect(m.nativeMap.setCamera.mock.calls.at(-1)?.[0].altitude).toBeCloseTo(APPLE_MIN_ALTITUDE);
  pins().forEach((pin, i) => expect(pin.props.coordinate).toBe(original[i]));
});

it('leaves globe presentation after native recentering, preserving the new location', async () => {
  await act(async () => handle.current!.zoomBy(-30));
  const destination = { latitude: 51.5, longitude: -0.1 };
  m.nativeMap.getCamera.mockResolvedValue({
    center: destination,
    altitude: 10_000,
    heading: 0,
    pitch: 0,
  });
  await act(async () => {
    handle.current!.recenter(destination);
    mapView().props.onRegionChangeComplete({
      ...destination,
      latitudeDelta: 0.06,
      longitudeDelta: 0.05,
    });
    vi.advanceTimersByTime(200);
  });
  expect(m.nativeMap.animateToRegion).toHaveBeenCalledWith(
    { ...destination, latitudeDelta: 0.06, longitudeDelta: 0.05 },
    0,
  );
  expect(mapView().props.mapType).toBe('mutedStandard');
  expect(mapView().props.style).toMatchObject({ height: 852, top: 0 });
  expect(m.nativeMap.setCamera.mock.calls.at(-1)?.[0]).toMatchObject({ center: destination });
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

it('renders the authorized meetup creator even when their live location is private', async () => {
  const state = createSeed();
  const meetup = state.meetups[0];
  const creator = {
    ...state.people.find((p) => p.user.id === meetup.hostId)!,
    location: undefined,
  };
  props = { ...props, people: [], meetups: [meetup], meetupHosts: { [meetup.hostId]: creator } };
  await act(async () => {
    tree.update(<SocialMap {...props} />);
  });
  const marker = tree.root.findByType('MeetupMarker' as React.ElementType);
  expect(marker.props.host).toBe(creator);
  expect(marker.props.meetup.hostId).toBe(creator.user.id);
  await act(async () => {
    marker.props.onPress();
  });
  expect(props.onMeetupPress).toHaveBeenCalledWith(meetup.id);
  props = { ...props, meetupHosts: {} };
  await act(async () => {
    tree.update(<SocialMap {...props} />);
  });
  expect(tree.root.findByType('MeetupMarker' as React.ElementType).props.host).toBeUndefined();
});
