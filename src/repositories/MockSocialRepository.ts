import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateSnapshot } from './migration';
import { createSeed } from '../mocks/seed';
import type { AppSnapshot, LegacySnapshot } from '../types/domain';
import type { SocialRepository } from './SocialRepository';

const KEY = 'zuno.demo.v1';
export class MockSocialRepository implements SocialRepository {
  constructor(
    private readonly key = KEY,
    private readonly seed = createSeed,
  ) {}
  private queue: Promise<void> = Promise.resolve();
  async load(): Promise<AppSnapshot> {
    const raw = await AsyncStorage.getItem(this.key);
    if (!raw) return this.seed();
    try {
      const data = JSON.parse(raw) as AppSnapshot | LegacySnapshot;
      if (
        (data.version !== 1 && data.version !== 2) ||
        !Array.isArray(data.people) ||
        !data.people.some((p) => p.user.id === data.currentUserId) ||
        !data.privacy ||
        !Array.isArray(data.friendships) ||
        !Array.isArray(data.messages) ||
        !(data.version === 1 ? Array.isArray(data.plans) : Array.isArray(data.meetups)) ||
        !Array.isArray(data.blocks) ||
        !Array.isArray(data.reports)
      )
        return this.seed();
      // Restarting the demo never silently resumes precise or temporary sharing.
      const migrated = migrateSnapshot(data);
      return {
        ...migrated,
        privacy: { ...migrated.privacy, mode: 'hidden', temporary: undefined },
      };
    } catch {
      return this.seed();
    }
  }
  save(snapshot: AppSnapshot) {
    this.queue = this.queue
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(this.key, JSON.stringify(snapshot)));
    return this.queue;
  }
  async clear() {
    await this.queue.catch(() => undefined);
    await AsyncStorage.removeItem(this.key);
  }
}
