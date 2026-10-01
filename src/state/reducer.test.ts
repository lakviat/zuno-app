import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { reducer } from './reducer';
import { isFriend } from '../utils/privacy';
const now = new Date().toISOString();
describe('social interactions', () => {
  it('accepts only incoming requests and prevents duplicate outgoing requests', () => {
    let s = createSeed();
    s = reducer(s, { type: 'friend', id: 'mia', operation: 'add', now });
    const count = s.friendships.length;
    s = reducer(s, { type: 'friend', id: 'mia', operation: 'add', now });
    expect(s.friendships.length).toBe(count);
    s = reducer(s, { type: 'friend', id: 'mia', operation: 'accept', now });
    expect(isFriend(s, 'mia')).toBe(false);
    s = reducer(s, { type: 'friend', id: 'noah', operation: 'accept', now });
    expect(isFriend(s, 'noah')).toBe(true);
  });
  it('blocks messaging, removes friendship, and revokes temporary access', () => {
    let s = createSeed();
    s.privacy.temporary = { friendIds: ['alex', 'emma'], expiresAt: '2099-01-01' };
    s = reducer(s, { type: 'friend', id: 'alex', operation: 'block', now });
    expect(isFriend(s, 'alex')).toBe(false);
    expect(s.privacy.temporary?.friendIds).toEqual(['emma']);
    const after = reducer(s, {
      type: 'message',
      friendId: 'alex',
      message: {
        id: 'test',
        conversationId: 'c-alex',
        senderId: 'me',
        text: 'hello',
        createdAt: now,
        state: 'sent',
      },
    });
    expect(after.messages).toEqual(s.messages);
    expect(reducer(s, { type: 'friend', id: 'alex', operation: 'add', now }).friendships).toEqual(
      s.friendships,
    );
  });
  it('ghost mode cancels temporary sharing', () => {
    const s = reducer(createSeed(), {
      type: 'privacy',
      value: {
        mode: 'precise',
        ghostMode: true,
        temporary: { friendIds: ['alex'], expiresAt: '2099-01-01' },
      },
    });
    expect(s.privacy.temporary).toBeUndefined();
  });
  it('runs meetup policy inside the reducer, rejecting unauthorized commands', () => {
    const state = createSeed();
    const after = reducer(state, {
      type: 'meetup',
      actorId: 'noah',
      now: Date.now(),
      command: { operation: 'join', id: state.meetups[0].id },
    });
    expect(after).toBe(state);
  });
});
