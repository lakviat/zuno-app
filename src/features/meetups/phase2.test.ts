import { describe, expect, it } from 'vitest';
import { createSeed } from '../../mocks/seed';
import { executeMeetup, listVisibleMeetups, meetupLifecycle } from './domain';
import { canReadMeetupChat, meetupMessages, sendMeetupMessage } from './chatDomain';
import { mapPlace } from './mapPlace';
import { migrateSnapshot } from '../../repositories/migration';
import type { AppSnapshot, MeetupDraft } from '../../types/domain';
const now = Date.now();
function create(state = createSeed(), override: Partial<MeetupDraft> = {}) {
  const place = mapPlace({ latitude: 26.1224, longitude: -80.1373 });
  const result = executeMeetup(
    state,
    'me',
    {
      operation: 'create',
      id: 'phase2',
      draft: {
        title: 'Airsoft Saturday',
        description: '',
        emoji: '🎯',
        placeId: place.id,
        place,
        startsAt: new Date(now).toISOString(),
        endsAt: new Date(now + 7200000).toISOString(),
        startNow: true,
        visibility: 'public',
        invitedUserIds: [],
        ...override,
      },
    },
    now,
  );
  if (!result.ok) throw new Error(result.error);
  return result.snapshot;
}
function act(state: AppSnapshot, actorId: string, operation: 'join' | 'leave' | 'cancel') {
  const result = executeMeetup(state, actorId, { operation, id: 'phase2' }, now + 100);
  if (!result.ok) throw new Error(result.error);
  return result.snapshot;
}
describe('map-native meetup lifecycle and chat', () => {
  it('creates a custom activity at an arbitrary map coordinate and discovers by viewport', () => {
    const state = create();
    const m = state.meetups.at(-1)!;
    expect(m.place.coordinate.latitude).toBe(26.1224);
    expect(meetupLifecycle(m, now)).toBe('active');
    expect(
      listVisibleMeetups(state, 'noah', {
        now,
        viewport: { latitude: 26.12, longitude: -80.13, latitudeDelta: 0.08, longitudeDelta: 0.08 },
      }),
    ).toContainEqual(m);
    expect(
      listVisibleMeetups(state, 'noah', {
        now,
        viewport: { latitude: 25.79, longitude: -80.14, latitudeDelta: 0.08, longitudeDelta: 0.08 },
      }),
    ).not.toContainEqual(m);
    expect(listVisibleMeetups(state, 'noah', { now: now + 7200001 })).not.toContainEqual(m);
  });
  it('atomically joins, opens chat, persists, leaves and revokes access without duplicate events', () => {
    let state = create();
    expect(canReadMeetupChat(state, 'noah', 'phase2')).toBe(false);
    state = act(state, 'noah', 'join');
    state = act(state, 'noah', 'join');
    expect(canReadMeetupChat(state, 'noah', 'phase2')).toBe(true);
    expect(
      meetupMessages(state, 'noah', 'phase2').filter((m) => m.text.includes('joined')),
    ).toHaveLength(1);
    state = sendMeetupMessage(state, 'noah', 'phase2', 'See you there!', 'chat-one', now + 200);
    state = migrateSnapshot(JSON.parse(JSON.stringify(state)));
    expect(meetupMessages(state, 'me', 'phase2').at(-1)?.text).toBe('See you there!');
    state = act(state, 'noah', 'leave');
    expect(meetupMessages(state, 'noah', 'phase2')).toEqual([]);
    expect(sendMeetupMessage(state, 'noah', 'phase2', 'No access', 'bad', now)).toBe(state);
    expect(meetupMessages(state, 'me', 'phase2').at(-1)?.text).toContain('left');
  });
  it('keeps archive for participants and makes it read-only, including active cancellation', () => {
    let state = act(create(), 'noah', 'join');
    state = act(state, 'me', 'cancel');
    expect(meetupLifecycle(state.meetups.at(-1)!, now)).toBe('cancelled');
    expect(canReadMeetupChat(state, 'noah', 'phase2')).toBe(true);
    expect(sendMeetupMessage(state, 'noah', 'phase2', 'Archived', 'bad', now)).toBe(state);
  });
  it('rejects malformed coordinates, protects private chat, and respects blocks', () => {
    expect(() =>
      create(undefined, {
        place: {
          ...mapPlace({ latitude: 26, longitude: -80 }),
          coordinate: { latitude: NaN, longitude: -80 },
        },
      }),
    ).toThrow('valid meeting spot');
    const state = create(undefined, { visibility: 'invite-only', invitedUserIds: ['alex'] });
    expect(canReadMeetupChat(state, 'noah', 'phase2')).toBe(false);
    const joined = act(create(), 'noah', 'join');
    joined.blocks.push({
      blockerId: 'me',
      blockedId: 'noah',
      createdAt: new Date(now).toISOString(),
    });
    expect(canReadMeetupChat(joined, 'noah', 'phase2')).toBe(false);
  });
});
