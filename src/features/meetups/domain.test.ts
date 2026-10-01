import { describe, expect, it } from 'vitest';
import { createSeed } from '../../mocks/seed';
import { reducer } from '../../state/reducer';
import type { AppSnapshot, MeetupDraft } from '../../types/domain';
import { executeMeetup, getAuthorizedMeetup, listVisibleMeetups } from './domain';
import { toInstant } from './localTime';
const now = Date.parse('2026-10-01T12:00:00Z');
const draft: MeetupDraft = {
  title: 'Coffee in good company',
  description: '',
  emoji: '☕',
  placeId: 'panther',
  startsAt: '2026-10-02T12:00:00Z',
  endsAt: '2026-10-02T14:00:00Z',
  visibility: 'public',
  invitedUserIds: [],
  capacity: 2,
};
function create(value: Partial<MeetupDraft> = {}) {
  const result = executeMeetup(
    createSeed(),
    'me',
    { operation: 'create', id: 'test', draft: { ...draft, ...value } },
    now,
  );
  if (!result.ok) throw new Error(result.error);
  return result.snapshot;
}
function transact(state: AppSnapshot, actor: string, operation: 'join' | 'leave' | 'cancel') {
  const result = executeMeetup(state, actor, { operation, id: 'test' }, now);
  if (!result.ok) throw new Error(result.error);
  return result.snapshot;
}
describe('meetup authorization and lifecycle', () => {
  it('allows area-based public discovery, without a location or friendship permission', () => {
    const s = create();
    expect(getAuthorizedMeetup(s, 'noah', 'test')?.place.kind).toBe('public-venue');
    expect(
      listVisibleMeetups(s, 'noah', { now, areaId: 'sunset-harbour' }).map((m) => m.id),
    ).toContain('test');
    expect(listVisibleMeetups(s, 'noah', { now, areaId: 'south-beach' })).toEqual([]);
    const joined = transact(s, 'noah', 'join');
    expect(joined.people).toBe(s.people);
    expect(joined.privacy).toBe(s.privacy);
    expect(joined.friendships).toBe(s.friendships);
    expect(
      reducer(joined, {
        type: 'message',
        friendId: 'noah',
        message: {
          id: 'x',
          conversationId: 'x',
          senderId: 'me',
          text: 'hi',
          state: 'sent',
          createdAt: draft.startsAt,
        },
      }).messages,
    ).toBe(s.messages);
  });
  it('enforces audience on list, direct lookup and join, including pending requests', () => {
    const friends = create({ visibility: 'friends' });
    expect(getAuthorizedMeetup(friends, 'noah', 'test')).toBeUndefined();
    expect(listVisibleMeetups(friends, 'noah', { now, areaId: 'sunset-harbour' })).toEqual([]);
    expect(executeMeetup(friends, 'noah', { operation: 'join', id: 'test' }, now).ok).toBe(false);
    expect(getAuthorizedMeetup(friends, 'alex', 'test')).toBeDefined();
    const invited = create({ visibility: 'invite-only', invitedUserIds: ['alex'] });
    expect(getAuthorizedMeetup(invited, 'alex', 'test')).toBeDefined();
    expect(getAuthorizedMeetup(invited, 'jules', 'test')).toBeUndefined();
    expect(invited.meetups.at(-1)?.participantIds).toEqual(['me']);
  });
  it.each([
    ['me', 'noah'],
    ['noah', 'me'],
  ])('applies blocks from %s to %s', (blockerId, blockedId) => {
    const s = create();
    s.blocks.push({ blockerId, blockedId, createdAt: draft.startsAt });
    expect(getAuthorizedMeetup(s, 'noah', 'test')).toBeUndefined();
    expect(listVisibleMeetups(s, 'noah', { now, areaId: 'sunset-harbour' })).toEqual([]);
    expect(executeMeetup(s, 'noah', { operation: 'join', id: 'test' }, now).ok).toBe(false);
  });
  it('counts host, makes join/leave idempotent, and rejects a third participant when full', () => {
    const s = create();
    const joined = transact(s, 'noah', 'join');
    expect(joined.meetups.at(-1)?.participantIds).toEqual(['me', 'noah']);
    expect(transact(joined, 'noah', 'join')).toBe(joined);
    expect(executeMeetup(joined, 'mia', { operation: 'join', id: 'test' }, now).ok).toBe(false);
    const left = transact(joined, 'noah', 'leave');
    expect(left.meetups.at(-1)?.participantIds).toEqual(['me']);
    expect(transact(left, 'noah', 'leave')).toBe(left);
    expect(executeMeetup(s, 'me', { operation: 'leave', id: 'test' }, now).ok).toBe(false);
  });
  it('restricts edits and cancellations to the upcoming host and preserves Joined history', () => {
    const s = transact(create(), 'noah', 'join');
    expect(executeMeetup(s, 'noah', { operation: 'cancel', id: 'test' }, now).ok).toBe(false);
    expect(executeMeetup(s, 'noah', { operation: 'edit', id: 'test', draft }, now).ok).toBe(false);
    expect(
      executeMeetup(
        s,
        'me',
        { operation: 'edit', id: 'test', draft: { ...draft, capacity: 1 } },
        now,
      ).ok,
    ).toBe(false);
    expect(
      executeMeetup(
        s,
        'me',
        { operation: 'edit', id: 'test', draft: { ...draft, visibility: 'friends' } },
        now,
      ).ok,
    ).toBe(false);
    const edited = executeMeetup(
      s,
      'me',
      { operation: 'edit', id: 'test', draft: { ...draft, title: 'New title', capacity: 3 } },
      now,
    );
    expect(edited.ok && edited.meetup.title).toBe('New title');
    const cancelled = transact(s, 'me', 'cancel');
    expect(listVisibleMeetups(cancelled, 'noah', { now, areaId: 'sunset-harbour' })).toEqual([]);
    expect(
      listVisibleMeetups(cancelled, 'noah', { now, areaId: 'sunset-harbour', filter: 'joined' })[0]
        .status,
    ).toBe('cancelled');
    expect(executeMeetup(cancelled, 'mia', { operation: 'join', id: 'test' }, now).ok).toBe(false);
    const later = Date.parse(draft.endsAt);
    expect(listVisibleMeetups(s, 'noah', { now: later, areaId: 'sunset-harbour' })).toEqual([]);
    expect(
      listVisibleMeetups(s, 'noah', { now: later, areaId: 'sunset-harbour', filter: 'joined' }),
    ).toHaveLength(1);
    expect(executeMeetup(s, 'mia', { operation: 'join', id: 'test' }, later).ok).toBe(false);
    expect(executeMeetup(s, 'me', { operation: 'edit', id: 'test', draft }, later).ok).toBe(false);
  });
  it('lets a host edit after a member was blocked, while keeping the blocked viewer denied', () => {
    const state = transact(create(), 'noah', 'join');
    state.blocks.push({ blockerId: 'me', blockedId: 'noah', createdAt: draft.startsAt });
    const result = executeMeetup(
      state,
      'me',
      { operation: 'edit', id: 'test', draft: { ...draft, title: 'Updated coffee' } },
      now,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(getAuthorizedMeetup(result.snapshot, 'noah', 'test')).toBeUndefined();
  });
  it.each([
    { title: '' },
    { startsAt: 'invalid' },
    { endsAt: draft.startsAt },
    { startsAt: '2020-01-01' },
    { capacity: 0 },
    { capacity: 1.5 },
    { capacity: NaN },
    { placeId: 'my-home' },
    { invitedUserIds: ['noah'] },
  ])('rejects invalid drafts %j', (invalid) => {
    expect(
      executeMeetup(
        createSeed(),
        'me',
        { operation: 'create', id: 'test', draft: { ...draft, ...invalid } },
        now,
      ).ok,
    ).toBe(false);
  });
  it('rejects malformed local dates rather than silently normalizing them', () => {
    expect(toInstant('2026-02-30T12:00')).toBe('');
    expect(toInstant('2026-10-01T12:00')).toMatch(/Z$/);
  });
});
