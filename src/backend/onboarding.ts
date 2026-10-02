import type { SupabaseClient } from '@supabase/supabase-js';
export type Visibility = 'private' | 'friends' | 'public';
export interface Onboarding {
  step: 'profile' | 'location' | 'complete';
  completedAt: string | null;
  name: string;
  username: string;
  bio: string;
  avatar: string | null;
  visibility: Visibility;
}
export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}
export function validUsername(value: string) {
  return /^[a-z0-9_]{3,40}$/.test(normalizeUsername(value));
}
export async function onboardingState(client: SupabaseClient): Promise<Onboarding> {
  const { data, error } = await client.rpc('zuno_onboarding_state');
  if (error || !data || !['profile', 'location', 'complete'].includes(data.step))
    throw new Error('Could not load your profile.');
  return data as Onboarding;
}
export type StartupRoute = 'loading' | 'welcome' | 'retry' | 'profile' | 'location' | 'map';
export function startupRoute(
  ready: boolean,
  signedIn: boolean,
  loading: boolean,
  profile: Onboarding | null,
): StartupRoute {
  if (!ready || loading) return 'loading';
  if (!signedIn) return 'welcome';
  if (!profile) return 'retry';
  return profile.step === 'complete' ? 'map' : profile.step;
}
