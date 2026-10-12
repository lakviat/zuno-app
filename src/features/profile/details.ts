import type { AppSnapshot } from '../../types/domain';
import type { LocationSample } from '../location/motion';
import { discoverablePeople } from '../presence/domain';
import { distanceMeters, validCoordinate } from '../../utils/geo';

/** Accept a handle or an Instagram profile URL; never open arbitrary user-supplied URLs. */
export function instagramHandle(input: string): string | undefined {
  let handle = input.trim();
  if (!handle) return '';
  if (/^(https?:\/\/)?(www\.)?instagram\.com\//i.test(handle)) {
    try {
      const url = new URL(/^https?:\/\//i.test(handle) ? handle : `https://${handle}`);
      handle = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    } catch {
      return undefined;
    }
  }
  handle = handle.replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : undefined;
}
export function instagramUrl(handle: string) {
  const valid = instagramHandle(handle);
  return valid ? `https://www.instagram.com/${valid}/` : undefined;
}

/** Calculate only from the same authorized projection as the map, never raw peer GPS. */
export function profileDistance(
  state: AppSnapshot,
  userId: string,
  now: number,
  device?: LocationSample,
) {
  const target = discoverablePeople(state, now).find((p) => p.user.id === userId)?.location;
  if (!target || !validCoordinate(target.coordinate)) return undefined;
  const me = state.people.find((p) => p.user.id === state.currentUserId)?.location;
  const fresh = (time: number) => time <= now + 10000 && now - time < 90000;
  const source =
    state.dataMode === 'cloud'
      ? device && fresh(device.timestamp)
        ? { coordinate: device.coordinate, accuracyMeters: device.accuracy, precision: 'precise' }
        : me && fresh(Date.parse(me.updatedAt))
          ? me
          : undefined
      : me;
  if (!source || !validCoordinate(source.coordinate)) return undefined;
  const unit = state.discovery.units === 'kmh' ? 'km' : 'mi';
  const distance =
    distanceMeters(source.coordinate, target.coordinate) / (unit === 'km' ? 1000 : 1609.344);
  const approximate =
    target.precision === 'approximate' ||
    target.accuracyMeters > 500 ||
    source.precision === 'approximate' ||
    source.accuracyMeters > 500;
  if (approximate) return `About ${Math.max(1, Math.round(distance))} ${unit} away`;
  return distance < 0.1 ? `Less than 0.1 ${unit} away` : `${distance.toFixed(1)} ${unit} away`;
}
