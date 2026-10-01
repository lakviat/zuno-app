import { describe, expect, it, vi } from 'vitest';
import { createLegacySeed } from '../mocks/seed';
import { migrateSnapshot } from './migration';
import { MockSocialRepository } from './MockSocialRepository';
import { executeMeetup } from '../features/meetups/domain';
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: async (key: string) => {
      storage.delete(key);
    },
  },
}));
describe('versioned local persistence', () => {
  it('migrates Friends only, preserves unrelated data, and does not turn interested into joined', () => {
    const old = createLegacySeed();
    old.privacy = { mode: 'approximate', ghostMode: true };
    old.people[0].profile.displayName = 'Saved name';
    const next = migrateSnapshot(old);
    const { plans: _plans, version: _version, ...before } = old;
    const { meetups: _meetups, version: _nextVersion, ...after } = next;
    expect({
      ...after,
      conversations: after.conversations.filter((c) => !c.meetupId),
    }).toMatchObject(before);
    expect(next.conversations.filter((c) => c.meetupId)).toHaveLength(old.plans.length);
    expect(next.people[0].presence.availableUntil).toBeDefined();
    expect(next.version).toBe(2);
    expect(next.meetups.every((m) => m.visibility === 'friends')).toBe(true);
    expect(next.meetups[0].participantIds).toEqual(['alex']);
    expect(migrateSnapshot(next)).toBe(next);
  });
  it('reads v1 from the existing storage key, persists v2 and preserves membership across reopening', async () => {
    storage.clear();
    const old = createLegacySeed();
    storage.set('zuno.demo.v1', JSON.stringify(old));
    const repository = new MockSocialRepository();
    const snapshot = await repository.load();
    const result = executeMeetup(snapshot, 'me', { operation: 'join', id: snapshot.meetups[0].id });
    if (!result.ok) throw new Error(result.error);
    await repository.save(result.snapshot);
    const reopened = await new MockSocialRepository().load();
    expect(reopened.meetups[0].participantIds).toContain('me');
    expect(reopened.messages.filter((m) => m.kind !== 'system')).toEqual(old.messages);
    expect(reopened.messages.filter((m) => m.kind === 'system')).toHaveLength(1);
    expect(reopened.people).toMatchObject(old.people);
    expect(JSON.parse(storage.get('zuno.demo.v1')!).version).toBe(2);
  });
});
