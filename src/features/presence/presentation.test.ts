import { describe, expect, it } from 'vitest';
import { createSeed } from '../../mocks/seed';
import { reducer } from '../../state/reducer';
import { activityOptions, presencePresentation } from './presentation';
import type { Presence } from '../../types/domain';

const now = Date.parse('2026-10-12T16:00:00Z');
const base: Presence = {
  userId: 'me',
  kind: 'online',
  emoji: '✌️',
  status: 'Hello',
  freeNow: false,
  updatedAt: new Date(now).toISOString(),
};
describe('activity badges for local and hosted presence', () => {
  it.each(activityOptions)(
    'uses the saved %s activity instead of the old profile emoji',
    (intent) => {
      const result = presencePresentation(
        { ...base, intent, availability: 'free', freeNow: true },
        now,
      );
      expect(result.emoji).toBe(intent.slice(0, intent.indexOf(' ')));
      expect(result.status).toBe(`Free now · ${intent.slice(intent.indexOf(' ') + 1)}`);
    },
  );
  it.each(['later', 'busy'] as const)(
    'keeps the activity visible when availability is %s',
    (availability) => {
      expect(presencePresentation({ ...base, availability, intent: '🏋️ Gym' }, now)).toEqual({
        emoji: '🏋️',
        status: `${availability === 'later' ? 'Maybe later' : 'Busy'} · Gym`,
      });
    },
  );
  it('handles clearing a previous activity, plain text, and custom emoji', () => {
    expect(presencePresentation({ ...base, availability: 'busy', intent: '' }, now)).toEqual({
      emoji: '⛔',
      status: 'Busy',
    });
    expect(presencePresentation({ ...base, availability: 'later', intent: 'Sushi?' }, now)).toEqual(
      { emoji: '💬', status: 'Maybe later · Sushi?' },
    );
    expect(
      presencePresentation({ ...base, availability: 'later', intent: '🚴🏽‍♀️ Bike ride' }, now),
    ).toEqual({ emoji: '🚴🏽‍♀️', status: 'Maybe later · Bike ride' });
  });
  it('retains legacy badges and stops showing expired Free now activities', () => {
    expect(presencePresentation(base, now)).toEqual({ emoji: '✌️', status: 'Hello' });
    const active = {
      ...base,
      availability: 'free' as const,
      freeNow: true,
      intent: '☕ Coffee',
      availableUntil: new Date(now + 1000).toISOString(),
    };
    expect(presencePresentation(active, now).emoji).toBe('☕');
    expect(presencePresentation(active, now + 1000)).toEqual({ emoji: '✌️', status: 'Hello' });
  });
  it('shows the saved greeting on the map and profile after JSON persistence', () => {
    const state = reducer(createSeed(), {
      type: 'availability',
      value: 'free',
      intent: '',
      status: 'I’m open',
      now,
    });
    const restored = JSON.parse(JSON.stringify(state)) as typeof state;
    const presence = restored.people.find((p) => p.user.id === state.currentUserId)!.presence;
    expect(presencePresentation(presence, now)).toEqual({ emoji: '👋', status: 'I’m open' });
  });
  it('survives a local save and JSON persistence without rewriting the editable profile status', () => {
    const state = createSeed();
    const original = state.people.find((p) => p.user.id === state.currentUserId)!.presence;
    const saved = reducer(state, { type: 'availability', value: 'free', intent: '🏋️ Gym', now });
    const restored = JSON.parse(JSON.stringify(saved)) as typeof state;
    const presence = restored.people.find((p) => p.user.id === state.currentUserId)!.presence;
    expect(presence.status).toBe(original.status);
    expect(presencePresentation(presence, now)).toEqual({ emoji: '🏋️', status: 'Free now · Gym' });
  });
});
