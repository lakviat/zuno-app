export type BackendConfiguration =
  | { status: 'unconfigured' }
  | { status: 'invalid'; message: string }
  | { status: 'configured'; url: string; publishableKey: string };

/** Explicit local preview only; never substitutes for real hosted authentication. */
export function allowPhonePreview({
  development,
  platform,
  hostname,
  flag,
  expoGo = false,
  expoGoFlag,
}: {
  development: boolean;
  platform: string;
  hostname: string;
  flag?: string;
  expoGo?: boolean;
  expoGoFlag?: string;
}) {
  return (
    development &&
    ((platform === 'web' &&
      flag === '1' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(hostname)) ||
      (platform === 'ios' && expoGo && expoGoFlag === '1'))
  );
}

/** Never allow an administrative credential to become an embedded app credential. */
export function backendConfiguration(url?: string, key?: string): BackendConfiguration {
  const address = url?.trim();
  const publishableKey = key?.trim();
  if (!address && !publishableKey) return { status: 'unconfigured' };
  if (!address || !publishableKey)
    return {
      status: 'invalid',
      message: 'Both Supabase client configuration values are required.',
    };
  try {
    const parsed = new URL(address);
    if (
      parsed.protocol !== 'https:' ||
      !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      (parsed.pathname !== '/' && parsed.pathname !== '') ||
      parsed.port
    )
      throw new Error('Invalid endpoint');
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey))
      return {
        status: 'invalid',
        message: 'Use a Supabase publishable key. Secret and service-role keys are not allowed.',
      };
    return { status: 'configured', url: parsed.origin, publishableKey };
  } catch {
    return {
      status: 'invalid',
      message: 'Use the HTTPS Project URL from the Supabase Connect dialog.',
    };
  }
}
