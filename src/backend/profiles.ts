import type { SupabaseClient } from '@supabase/supabase-js';
export interface CloudProfile {
  user_id: string;
  display_name: string;
  bio: string;
  updated_at: string;
}
export const PROFILE_COLUMNS = 'user_id,display_name,bio,updated_at';
export async function readCloudProfile(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from('zuno_profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as CloudProfile | null;
}
export async function saveCloudProfile(
  client: SupabaseClient,
  userId: string,
  name: string,
  bio: string,
) {
  if (!name.trim() || name.trim().length > 40 || bio.trim().length > 160)
    throw new Error('Use a name of 1–40 characters and a bio of at most 160 characters.');
  const {
    data: { session },
  } = await client.auth.getSession();
  if (session?.user.id !== userId) throw new Error('Your account changed. Please try again.');
  const { error } = await client
    .rpc('zuno_save_profile', {
      display_name: name.trim(),
      bio: bio.trim(),
    })
    .setHeader('Authorization', `Bearer ${session.access_token}`);
  if (error) throw error;
  return (await readCloudProfile(client, userId))!;
}
