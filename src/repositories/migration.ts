import type { AppSnapshot, LegacySnapshot, Meetup } from '../types/domain';
import { meetupPlaces } from '../features/meetups/places';

/** Keep every unrelated field intact, including privacy, messages and friendships. */
export function migrateSnapshot(data: LegacySnapshot | AppSnapshot): AppSnapshot {
  if (data.version === 2) return upgradeSocialWorld(data);
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
  return upgradeSocialWorld({ ...rest, version: 2, meetups });
}

/** Additive upgrade: preserve saved content; create only missing conversation records. */
function upgradeSocialWorld(state: AppSnapshot): AppSnapshot {
  const missingConversations = state.meetups.filter(
    (m) => !state.conversations.some((c) => c.meetupId === m.id),
  );
  const missingExpiry = state.people.some((p) => !p.presence.availableUntil);
  const missingFriendPolicy = state.people.some((p) => p.location && !p.friendPrivacy);
  const missingPublicFixture = state.people.some(
    (p) => p.user.id === 'mia' && !p.location && p.discoverability === undefined,
  );
  if (
    !missingConversations.length &&
    !missingExpiry &&
    !missingPublicFixture &&
    !missingFriendPolicy
  )
    return state;
  return {
    ...state,
    people: state.people.map((p) => ({
      ...p,
      // Legacy Person.location contains fictional friend-visible fixtures, not raw GPS.
      ...(p.location && !p.friendPrivacy
        ? { friendPrivacy: { mode: p.location.precision, ghostMode: false } }
        : {}),
      ...(p.user.id === 'mia' && !p.location && p.discoverability === undefined
        ? {
            discoverability: 'public' as const,
            publicDiscoveryLocation: {
              userId: p.user.id,
              coordinate: { latitude: 25.78, longitude: -80.12 },
              accuracyMeters: 2500,
              precision: 'approximate' as const,
              place: 'Miami Beach neighborhood',
              updatedAt: p.presence.updatedAt,
            },
          }
        : {}),
      presence: {
        ...p.presence,
        availableUntil:
          p.presence.availableUntil ??
          new Date(Date.parse(p.presence.updatedAt) + 2 * 3600000).toISOString(),
      },
    })),
    conversations: [
      ...state.conversations,
      ...missingConversations.map((m) => ({
        id: `meetup:${m.id}`,
        meetupId: m.id,
        participantIds: m.participantIds,
        unreadCount: 0,
      })),
    ],
  };
}
