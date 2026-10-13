import type { BackendConfiguration } from './config';

export class ProviderAvailabilityError extends Error {}

/** Check the hosted setting before opening a browser/native sheet that cannot succeed. */
export async function requireSocialProvider(
  config: BackendConfiguration,
  provider: 'apple' | 'google',
  request: typeof fetch = fetch,
) {
  const label = provider === 'apple' ? 'Apple' : 'Google';
  if (config.status !== 'configured')
    throw new ProviderAvailabilityError(`${label} sign-in isn’t configured in this build.`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    // This endpoint contains public provider flags, not user data. Do not send a session token.
    const response = await request(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.publishableKey },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('settings-unavailable');
    const settings = await response.json();
    const enabled = settings?.external?.[provider];
    if (enabled === false)
      throw new ProviderAvailabilityError(
        `${label} sign-in isn’t enabled for Zuno yet. Please use email for now.`,
      );
    if (enabled !== true) throw new Error('invalid-settings');
  } catch (issue) {
    if (issue instanceof ProviderAvailabilityError) throw issue;
    throw new ProviderAvailabilityError(
      `Couldn’t connect to ${label} sign-in. Check your connection and try again.`,
    );
  } finally {
    clearTimeout(timer);
  }
}
