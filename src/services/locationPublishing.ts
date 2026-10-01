import type { AppSnapshot, Location } from '../types/domain';
import type { LocationSample } from '../features/location/motion';
import { publicLocation } from '../features/presence/domain';
import { isBlocked, isFriend, locationForViewer } from '../utils/privacy';
export interface LocationPublication {
  friendVisibleLocations: {
    viewerId: string;
    location: Location;
    motion?: Pick<LocationSample, 'speed' | 'heading'>;
  }[];
  publicDiscoveryLocation?: Location;
}
export interface LocationPublisher {
  publish(value: LocationPublication): Promise<void>;
  clear(): Promise<void>;
}
/** No network adapter until server-side consent and audience enforcement exist. */
export const localLocationPublisher: LocationPublisher = { async publish() {}, async clear() {} };
export function publicationFor(state: AppSnapshot, sample: LocationSample): LocationPublication {
  const actual: Location = {
    userId: state.currentUserId,
    coordinate: sample.coordinate,
    accuracyMeters: sample.accuracy,
    updatedAt: new Date(sample.timestamp).toISOString(),
    place: 'Shared location',
    precision: 'precise',
  };
  if (state.privacy.ghostMode || state.discovery.mode === 'hidden')
    return { friendVisibleLocations: [] };
  return {
    friendVisibleLocations: state.people.flatMap((p) => {
      if (!isFriend(state, p.user.id) || isBlocked(state, p.user.id)) return [];
      const location = locationForViewer(actual, state.privacy, true, p.user.id, sample.timestamp);
      return location
        ? [
            {
              viewerId: p.user.id,
              location,
              ...(location.precision === 'precise'
                ? { motion: { speed: sample.speed, heading: sample.heading } }
                : {}),
            },
          ]
        : [];
    }),
    publicDiscoveryLocation:
      state.discovery.mode === 'public' && state.discovery.optedIn
        ? publicLocation(actual)
        : undefined,
  };
}
