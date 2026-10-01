import { migrateSnapshot } from '../repositories/migration';
import type { AppSnapshot, LegacySnapshot, Person, Place } from '../types/domain';

export const places: Place[] = [
  {
    id: 'panther',
    name: 'Panther Coffee',
    area: 'Sunset Harbour',
    coordinate: { latitude: 25.7931, longitude: -80.1449 },
    precision: 'precise',
  },
  {
    id: 'beach',
    name: 'South Beach',
    area: 'Miami Beach',
    coordinate: { latitude: 25.7752, longitude: -80.1308 },
    precision: 'approximate',
  },
  {
    id: 'park',
    name: 'Flamingo Park',
    area: 'South Beach',
    coordinate: { latitude: 25.7811, longitude: -80.1394 },
    precision: 'precise',
  },
];
export function createLegacySeed(): LegacySnapshot {
  const now = Date.now();
  const iso = (minutes = 0) => new Date(now + minutes * 60000).toISOString();
  const makePerson = (
    id: string,
    name: string,
    color: string,
    status: string,
    emoji: string,
    free: boolean,
    latitude?: number,
    longitude?: number,
    place?: string,
  ): Person => ({
    user: { id, createdAt: iso(-43200) },
    profile: {
      userId: id,
      displayName: name,
      username: name.toLowerCase().replace(' ', '.'),
      bio:
        id === 'me'
          ? 'Collecting little moments & good coffee ☀️'
          : 'Better days start with good company.',
      city: 'Miami Beach',
      avatar: id,
      color,
    },
    presence: {
      userId: id,
      kind: free ? 'online' : 'recent',
      status,
      emoji,
      updatedAt: iso(id === 'alex' ? -3 : -1),
      freeNow: free,
    },
    ...(latitude !== undefined && longitude !== undefined
      ? {
          location: {
            userId: id,
            coordinate: { latitude, longitude },
            accuracyMeters: 20,
            updatedAt: iso(-3),
            place: place ?? 'Miami Beach',
            precision: 'precise' as const,
          },
        }
      : {}),
  });
  return {
    version: 1,
    currentUserId: 'me',
    people: [
      makePerson(
        'me',
        'Maya Chen',
        '#F26B50',
        'Up for a little adventure',
        '✌️',
        true,
        25.7848,
        -80.1416,
        'Lincoln Road',
      ),
      makePerson(
        'alex',
        'Alex Rivera',
        '#EDAA62',
        'Coffee, anyone?',
        '☕',
        true,
        25.7968,
        -80.1472,
        'Panther Coffee',
      ),
      makePerson(
        'jules',
        'Jules Martin',
        '#C59ACE',
        'Vitamin sea',
        '🌊',
        true,
        25.8043,
        -80.1271,
        'Miami Beach',
      ),
      makePerson(
        'marcus',
        'Marcus Lee',
        '#85ACA0',
        'On a little walk',
        '🌿',
        false,
        25.7811,
        -80.1523,
        'West Avenue',
      ),
      makePerson(
        'sophia',
        'Sofia Davis',
        '#E2A48F',
        'Beach kind of day',
        '☀️',
        true,
        25.7869,
        -80.1263,
        'Lummus Park',
      ),
      makePerson(
        'leo',
        'Leo Johnson',
        '#97ABCE',
        'Working on something',
        '💻',
        false,
        25.8,
        -80.166,
        'Venetian Islands',
      ),
      makePerson(
        'emma',
        'Emma Wilson',
        '#B5BE88',
        'Taking it slow',
        '🎧',
        true,
        25.771,
        -80.1403,
        'South of Fifth',
      ),
      makePerson('noah', 'Noah Kim', '#97ABCE', 'Always down for coffee', '☕', true),
      makePerson('mia', 'Mia Thompson', '#E2A48F', 'Chasing sunsets', '🌅', true),
    ],
    friendships: [
      ...['alex', 'jules', 'marcus', 'sophia', 'leo', 'emma'].map((id) => ({
        id: `f-${id}`,
        requesterId: 'me',
        addresseeId: id,
        status: 'accepted' as const,
        createdAt: iso(-1440),
      })),
      {
        id: 'f-noah',
        requesterId: 'noah',
        addresseeId: 'me',
        status: 'pending',
        createdAt: iso(-45),
      },
    ],
    conversations: [
      { id: 'c-alex', participantIds: ['me', 'alex'], unreadCount: 2 },
      { id: 'c-jules', participantIds: ['me', 'jules'], unreadCount: 1 },
      { id: 'c-marcus', participantIds: ['me', 'marcus'], unreadCount: 0 },
    ],
    messages: [
      {
        id: 'm1',
        conversationId: 'c-alex',
        senderId: 'me',
        text: 'This weather is too good to stay inside ☀️',
        createdAt: iso(-25),
        state: 'read',
      },
      {
        id: 'm2',
        conversationId: 'c-alex',
        senderId: 'alex',
        text: 'Right? I’m at Panther, come through!',
        createdAt: iso(-12),
        state: 'read',
      },
      {
        id: 'm3',
        conversationId: 'c-alex',
        senderId: 'alex',
        text: 'Your usual is calling your name ☕',
        createdAt: iso(-3),
        state: 'sent',
      },
      {
        id: 'm4',
        conversationId: 'c-jules',
        senderId: 'jules',
        text: 'Beach later? Bringing the good playlist 🌊',
        createdAt: iso(-8),
        state: 'sent',
      },
      {
        id: 'm5',
        conversationId: 'c-marcus',
        senderId: 'marcus',
        text: 'That spot was so good. Same time next week?',
        createdAt: iso(-62),
        state: 'read',
      },
    ],
    plans: [
      {
        id: 'p-coffee',
        creatorId: 'alex',
        title: 'Coffee & a catch-up',
        description: 'No agenda. Just good coffee and your favorite people.',
        emoji: '☕',
        place: places[0],
        startsAt: iso(75),
        expiresAt: iso(240),
        invitedFriendIds: ['me', 'jules', 'emma'],
        participants: [
          { userId: 'alex', status: 'joined' },
          { userId: 'emma', status: 'interested' },
        ],
      },
      {
        id: 'p-beach',
        creatorId: 'jules',
        title: 'Chasing the sunset',
        description: 'Bring a blanket. I’ll bring the playlist.',
        emoji: '🌅',
        place: places[1],
        startsAt: iso(180),
        expiresAt: iso(360),
        invitedFriendIds: ['me', 'sophia', 'emma'],
        participants: [
          { userId: 'jules', status: 'joined' },
          { userId: 'sophia', status: 'joined' },
          { userId: 'emma', status: 'interested' },
        ],
      },
    ],
    blocks: [],
    reports: [],
    notifications: [],
    privacy: { mode: 'hidden', ghostMode: false },
    theme: 'light',
    discovery: { optedIn: false, interests: [] },
  };
}

export function createSeed(): AppSnapshot {
  return migrateSnapshot(createLegacySeed());
}
