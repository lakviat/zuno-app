import type { SupabaseClient } from '@supabase/supabase-js';
/** Storage owns file deletion; never delete storage metadata with SQL. */
export async function removeAccountPhotos(client: SupabaseClient, userId: string) {
  for (let page = 0; page < 100; page++) {
    const { data, error } = await client.storage.from('zuno-avatars').list(userId, { limit: 100 });
    if (error)
      throw new Error('Could not list your photos. Try again before deleting your account.');
    if (!data?.length) return;
    const { error: issue } = await client.storage
      .from('zuno-avatars')
      .remove(data.map((file) => `${userId}/${file.name}`));
    if (issue) throw new Error('Could not remove your photos. Please try again.');
  }
  throw new Error('More photos remain. Please try deleting again.');
}
