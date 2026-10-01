import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSeed } from '../mocks/seed';
import type { AppSnapshot } from '../types/domain';
import type { SocialRepository } from './SocialRepository';

const KEY = 'zuno.demo.v1';
export class MockSocialRepository implements SocialRepository {
  private queue: Promise<void> = Promise.resolve();
  async load(): Promise<AppSnapshot> {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return createSeed();
    try {
      const data = JSON.parse(raw) as AppSnapshot;
      if (
        data.version !== 1 ||
        !Array.isArray(data.people) ||
        !data.people.some((p) => p.user.id === data.currentUserId) ||
        !data.privacy ||
        !Array.isArray(data.friendships) ||
        !Array.isArray(data.messages) ||
        !Array.isArray(data.plans) ||
        !Array.isArray(data.blocks) ||
        !Array.isArray(data.reports)
      )
        return createSeed();
      // Restarting the demo never silently resumes precise or temporary sharing.
      return { ...data, privacy: { ...data.privacy, mode: 'hidden', temporary: undefined } };
    } catch {
      return createSeed();
    }
  }
  save(snapshot: AppSnapshot) {
    this.queue = this.queue
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(KEY, JSON.stringify(snapshot)));
    return this.queue;
  }
  async clear() {
    await this.queue.catch(() => undefined);
    await AsyncStorage.removeItem(KEY);
  }
}
