import type { AppSnapshot, Location, Person, Presence } from '../../types/domain';
import { approximateCoordinate } from '../../utils/geo';
import { isBlocked, isFriend, locationForViewer } from '../../utils/privacy';
export function isAvailable(p: Presence, now: number) {
  return (
    p.freeNow &&
    p.availability !== 'busy' &&
    p.availability !== 'later' &&
    Date.parse(p.availableUntil ?? new Date(Date.parse(p.updatedAt) + 7200000).toISOString()) > now
  );
}
export function publicLocation(location: Location): Location {
  return {
    userId: location.userId,
    coordinate: approximateCoordinate(location.coordinate),
    accuracyMeters: 2500,
    precision: 'approximate',
    place: 'Approximate neighborhood',
    updatedAt: new Date(Math.floor(Date.parse(location.updatedAt) / 900000) * 900000).toISOString(),
  };
}
/** Only safe map-facing projections leave this boundary. No stranger receives friend coordinates. */
export function discoverablePeople(state: AppSnapshot, now: number): Person[] {
  if (state.dataMode === 'cloud')
    return state.people.filter(
      (p) =>
        p.user.id !== state.currentUserId &&
        !isBlocked(state, p.user.id) &&
        p.location &&
        now - Date.parse(p.location.updatedAt) < 90000,
    );
  return state.people.flatMap((p) => {
    if (
      p.user.id === state.currentUserId ||
      isBlocked(state, p.user.id) ||
      state.discovery.hiddenUserIds?.includes(p.user.id) ||
      p.discoverability === 'hidden' ||
      p.friendPrivacy?.ghostMode
    )
      return [];
    const friend = isFriend(state, p.user.id);
    const location = friend
      ? locationForViewer(
          p.location,
          p.friendPrivacy ?? { mode: 'hidden', ghostMode: false },
          true,
          state.currentUserId,
          now,
        )
      : p.discoverability === 'public' && p.publicDiscoveryLocation
        ? publicLocation(p.publicDiscoveryLocation)
        : undefined;
    if (!location) return [];
    return [
      {
        user: p.user,
        profile: p.profile,
        presence: { ...p.presence, freeNow: isAvailable(p.presence, now) },
        location,
        mapAudience: friend ? ('friend' as const) : ('public' as const),
      },
    ];
  });
}
