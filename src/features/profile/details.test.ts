import { describe, expect, it } from 'vitest';
import { createSeed } from '../../mocks/seed';
import { instagramHandle, instagramUrl, profileDistance } from './details';

describe('social profile details', () => {
  it('normalizes handles/profile URLs and only builds Instagram links', () => {
    expect(instagramHandle(' @Some.Person_1 ')).toBe('some.person_1');
    expect(instagramHandle('https://www.instagram.com/Some.Person_1/?igsh=share')).toBe(
      'some.person_1',
    );
    expect(instagramHandle('')).toBe('');
    expect(instagramUrl('@some_person')).toBe('https://www.instagram.com/some_person/');
    for (const value of [
      'https://example.com/me',
      'javascript:alert(1)',
      'a'.repeat(31),
      'has spaces',
      'https://instagram.com.evil.test/me',
      'https://instagram.com/a/b',
    ]) {
      expect(instagramHandle(value)).toBeUndefined();
      expect(instagramUrl(value)).toBeUndefined();
    }
  });
  it('uses the authorized public approximation, and never exposes blocked or private distance', () => {
    const state = createSeed();
    expect(profileDistance(state, 'mia', Date.now())).toMatch(/^About \d+ mi away$/);
    expect(profileDistance(state, 'alex', Date.now())).toMatch(/mi away$/);
    const alex = state.people.find((p) => p.user.id === 'alex')!;
    alex.friendPrivacy = { mode: 'hidden', ghostMode: false };
    expect(profileDistance(state, 'alex', Date.now())).toBeUndefined();
    state.blocks.push({ blockerId: 'me', blockedId: 'mia', createdAt: new Date().toISOString() });
    expect(profileDistance(state, 'mia', Date.now())).toBeUndefined();
    expect(profileDistance(state, 'noah', Date.now())).toBeUndefined();
  });
  it('requires fresh real-device and peer locations in cloud mode; reduced accuracy stays approximate', () => {
    const state = createSeed();
    state.dataMode = 'cloud';
    const now = Date.now();
    const alex = state.people.find((p) => p.user.id === 'alex')!;
    alex.location!.updatedAt = new Date(now).toISOString();
    const sample = {
      coordinate: state.people[0].location!.coordinate,
      timestamp: now,
      accuracy: 10,
      speed: null,
      heading: null,
    };
    expect(profileDistance(state, 'alex', now, sample)).toMatch(/mi away$/);
    expect(
      profileDistance(state, 'alex', now, { ...sample, timestamp: now - 91000 }),
    ).toBeUndefined();
    expect(
      profileDistance(state, 'alex', now + 91000, { ...sample, timestamp: now + 91000 }),
    ).toBeUndefined();
    state.discovery.units = 'kmh';
    expect(profileDistance(state, 'alex', now, { ...sample, accuracy: 3000 })).toMatch(
      /^About \d+ km away$/,
    );
  });
});
