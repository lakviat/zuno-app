import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

// Only public mobile-client configuration may cross into a generated app bundle.
// Never source an arbitrary .env file as shell code or copy credentials to staging.
export function withBackendEnvironment(project, inherited = process.env) {
  const names = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_TERMS_URL',
    'EXPO_PUBLIC_PRIVACY_URL',
    // Native build metadata, not credentials or EXPO_PUBLIC values.
    'ZUNO_APPLE_TEAM_ID',
  ];
  const local = {};
  for (const file of ['.env', '.env.local']) {
    const location = path.join(project, file);
    if (!existsSync(location)) continue;
    const parsed = parseEnv(readFileSync(location, 'utf8'));
    for (const name of names) if (parsed[name] !== undefined) local[name] = parsed[name];
  }
  const env = { ...inherited };
  for (const name of names) env[name] = inherited[name] ?? local[name] ?? '';
  const url = env.EXPO_PUBLIC_SUPABASE_URL.trim();
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.trim();
  if (url || key) {
    if (
      !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)
    ) {
      throw new Error(
        'Supply both a Supabase HTTPS Project URL and a publishable key. No secret/service-role keys are permitted.',
      );
    }
  }
  env.EXPO_PUBLIC_SUPABASE_URL = url;
  env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
  return env;
}
