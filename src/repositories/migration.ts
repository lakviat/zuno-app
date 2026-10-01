import type { AppSnapshot, LegacySnapshot, Meetup } from '../types/domain';
import { meetupPlaces } from '../features/meetups/places';

/** Keep every unrelated field intact, including privacy, messages and friendships. */
export function migrateSnapshot(data: LegacySnapshot | AppSnapshot): AppSnapshot {
  if (data.version === 2) return data;
  const { plans, version: _version, ...rest } = data;
  const meetups: Meetup[] = plans.map((plan) => ({
    id: plan.id,
    hostId: plan.creatorId,
    title: plan.title,
    description: plan.description ?? '',
    emoji: plan.emoji,
    place: meetupPlaces.find((p) => p.id === plan.place.id) ?? {
      ...plan.place,
      name: 'Meeting area',
      kind: 'area',
      precision: 'approximate',
      areaId: plan.place.area === 'Sunset Harbour' ? 'sunset-harbour' : 'south-beach',
      coordinate: {
        latitude: Math.round(plan.place.coordinate.latitude * 100) / 100,
        longitude: Math.round(plan.place.coordinate.longitude * 100) / 100,
      },
    },
    startsAt: plan.startsAt,
    endsAt: plan.expiresAt,
    visibility: 'friends',
    status: 'scheduled',
    invitedUserIds: [
      ...new Set([
        ...plan.invitedFriendIds,
        ...plan.participants.filter((p) => p.status === 'interested').map((p) => p.userId),
      ]),
    ],
    participantIds: [
      ...new Set([
        plan.creatorId,
        ...plan.participants.filter((p) => p.status === 'joined').map((p) => p.userId),
      ]),
    ],
    createdAt: plan.startsAt,
    updatedAt: plan.startsAt,
  }));
  return { ...rest, version: 2, meetups };
}
