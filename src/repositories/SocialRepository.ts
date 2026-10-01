import type { AppSnapshot } from '../types/domain';
export interface SocialRepository {
  load(): Promise<AppSnapshot>;
  save(snapshot: AppSnapshot): Promise<void>;
  clear(): Promise<void>;
}
