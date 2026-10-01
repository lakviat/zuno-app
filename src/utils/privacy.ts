import type { AppSnapshot, ID, Location, LocationPrivacy } from '../types/domain';

export function isFriend(state: AppSnapshot, id: ID) {
  return state.friendships.some(
    (f) =>
      f.status === 'accepted' &&
      ((f.requesterId === state.currentUserId && f.addresseeId === id) ||
        (f.addresseeId === state.currentUserId && f.requesterId === id)),
  );
}
export function isBlocked(state: AppSnapshot, id: ID) {
  return state.blocks.some(
    (b) =>
      (b.blockerId === state.currentUserId && b.blockedId === id) ||
      (b.blockedId === state.currentUserId && b.blockerId === id),
  );
}
/** A future backend must enforce the same policy before serialization, with RLS. */
export function locationForViewer(
  location: Location | undefined,
  privacy: LocationPrivacy,
  trusted: boolean,
  viewerId: ID,
  now = Date.now(),
): Location | undefined {
  if (!location || !trusted || privacy.ghostMode) return undefined;
  const temporary =
    privacy.temporary &&
    Date.parse(privacy.temporary.expiresAt) > now &&
    privacy.temporary.friendIds.includes(viewerId);
  if (temporary) return { ...location, precision: 'precise' };
  if (privacy.mode === 'hidden') return undefined;
  if (privacy.mode === 'precise') return location;
  // A fixed ~2 km cell, never a random offset that can be averaged back to a precise point.
  return {
    ...location,
    coordinate: {
      latitude: Math.round(location.coordinate.latitude / 0.02) * 0.02,
      longitude: Math.round(location.coordinate.longitude / 0.02) * 0.02,
    },
    accuracyMeters: 2500,
    precision: 'approximate',
    place: 'Approximate neighborhood',
  };
}
