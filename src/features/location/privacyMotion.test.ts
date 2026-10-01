import { describe, expect, it } from 'vitest';
import { createSeed } from '../../mocks/seed';
import { discoverablePeople, isAvailable } from '../presence/domain';
import {
  canInterpolate,
  filterSample,
  motionLabel,
  updatePolicy,
  type LocationSample,
} from './motion';
import { publicationFor } from '../../services/locationPublishing';
import { inViewport } from '../../utils/geo';
const now = Date.now();
const sample: LocationSample = {
  coordinate: { latitude: 25.791234, longitude: -80.142345 },
  timestamp: now,
  accuracy: 10,
  speed: 10.7,
  heading: 359,
};
describe('location privacy and motion', () => {
  it('separates exact friend output, public grid, ghost and block policy', () => {
    const state = createSeed();
    state.discovery = { ...state.discovery, mode: 'public', optedIn: true };
    state.privacy.mode = 'precise';
    const result = publicationFor(state, sample);
    expect(result.friendVisibleLocations[0].location.coordinate).toEqual(sample.coordinate);
    expect(result.friendVisibleLocations[0].motion?.speed).toBe(sample.speed);
    state.privacy.mode = 'approximate';
    expect(publicationFor(state, sample).friendVisibleLocations[0].motion).toBeUndefined();
    state.privacy.mode = 'precise';
    expect(result.publicDiscoveryLocation?.coordinate).not.toEqual(sample.coordinate);
    expect(JSON.stringify(result.publicDiscoveryLocation)).not.toContain('25.791234');
    state.blocks.push({ blockerId: 'alex', blockedId: 'me', createdAt: '' });
    expect(
      publicationFor(state, sample).friendVisibleLocations.some((v) => v.viewerId === 'alex'),
    ).toBe(false);
    state.privacy.ghostMode = true;
    expect(publicationFor(state, sample)).toEqual({ friendVisibleLocations: [] });
  });
  it('never falls back to precise stranger coordinates and expiry removes free-now status', () => {
    const state = createSeed();
    const noah = state.people.find((p) => p.user.id === 'noah')!;
    noah.location = { ...state.people[0].location!, userId: 'noah' };
    noah.discoverability = 'public';
    expect(discoverablePeople(state, now).some((p) => p.user.id === 'noah')).toBe(false);
    noah.publicDiscoveryLocation = noah.location;
    const visible = discoverablePeople(state, now).find((p) => p.user.id === 'noah')!;
    expect(visible.location?.precision).toBe('approximate');
    expect(visible.publicDiscoveryLocation).toBeUndefined();
    expect(visible.location?.coordinate).not.toEqual(noah.location.coordinate);
    expect(isAvailable(noah.presence, now + 3 * 3600000)).toBe(false);
    state.discovery.hiddenUserIds = ['noah'];
    expect(discoverablePeople(state, now).some((p) => p.user.id === 'noah')).toBe(false);
  });
  it('rejects stale, inaccurate, out-of-order and impossible samples', () => {
    expect(filterSample({ ...sample, accuracy: 300 })).toBeUndefined();
    expect(filterSample({ ...sample, timestamp: now - 100000 })).toBeUndefined();
    expect(filterSample(sample, sample)).toBeUndefined();
    expect(
      filterSample(
        { ...sample, coordinate: { latitude: 0, longitude: 0 }, timestamp: now + 1000 },
        sample,
        now + 1000,
      ),
    ).toBeUndefined();
  });
  it('cleans native speed and smooths heading across north without inventing transport mode', () => {
    expect(filterSample({ ...sample, speed: -1 })?.speed).toBeNull();
    expect(filterSample({ ...sample, speed: NaN })?.speed).toBeNull();
    expect(motionLabel(filterSample({ ...sample, speed: 0.2 }), 'mph', now)).toBe('Stationary');
    const next = filterSample(
      { ...sample, heading: 1, timestamp: now + 5000 },
      sample,
      now + 5000,
    )!;
    expect(next.heading! < 5 || next.heading! > 355).toBe(true);
    expect(motionLabel(sample, 'mph', now)).toContain('24 mph');
    expect(motionLabel(sample, 'kmh', now)).toContain('39 km/h');
    expect(motionLabel(sample, 'mph', now + 100000)).toBe('Location not live');
    expect(updatePolicy(0).interval).toBeGreaterThan(updatePolicy(10).interval);
  });
  it('only interpolates recent neighboring fixes, never the first GPS fix or a long gap', () => {
    expect(canInterpolate(undefined, sample)).toBe(false);
    expect(canInterpolate(sample, { ...sample, timestamp: now + 5000 })).toBe(true);
    expect(canInterpolate(sample, { ...sample, timestamp: now + 100000 })).toBe(false);
    expect(
      canInterpolate(sample, {
        ...sample,
        coordinate: { latitude: 0, longitude: 0 },
        timestamp: now + 5000,
      }),
    ).toBe(false);
  });
  it('supports geographic discovery across the antimeridian', () => {
    expect(
      inViewport(
        { latitude: 0, longitude: -179.9 },
        { latitude: 0, longitude: 179.9, latitudeDelta: 1, longitudeDelta: 1 },
      ),
    ).toBe(true);
  });
});
