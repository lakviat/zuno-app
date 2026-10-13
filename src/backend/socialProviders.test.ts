import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireSocialProvider } from './socialProviders';

const config = {
  status: 'configured' as const,
  url: 'https://unit-fixture.supabase.co',
  publishableKey: 'sb_publishable_unit_fixture',
};
afterEach(() => vi.useRealTimers());

describe('hosted social provider availability', () => {
  it('uses public configuration only and checks the requested provider independently', async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({ external: { apple: false, google: true } }),
    );
    await expect(requireSocialProvider(config, 'google', request)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.publishableKey },
      signal: expect.any(AbortSignal),
    });
    await expect(requireSocialProvider(config, 'apple', request)).rejects.toThrow(
      'Apple sign-in isn’t enabled',
    );
  });
  it.each([{}, { external: { google: 'true' } }])(
    'does not interpret malformed settings as enabled: %j',
    async (body) => {
      const request = vi.fn<typeof fetch>(async () => Response.json(body));
      await expect(requireSocialProvider(config, 'google', request)).rejects.toThrow(
        'Check your connection',
      );
    },
  );
  it('does not expose server error text', async () => {
    const request = vi.fn<typeof fetch>(
      async () => new Response('internal details', { status: 500 }),
    );
    await expect(requireSocialProvider(config, 'google', request)).rejects.toThrow(
      'Couldn’t connect to Google sign-in. Check your connection and try again.',
    );
  });
  it('bounds a stalled connection and clears the timeout', async () => {
    vi.useFakeTimers();
    const request = vi.fn<typeof fetch>(
      async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const outcome = expect(requireSocialProvider(config, 'google', request)).rejects.toThrow(
      'Check your connection',
    );
    await vi.advanceTimersByTimeAsync(8000);
    await outcome;
    expect(vi.getTimerCount()).toBe(0);
  });
});
