import { useEffect, useState } from 'react';
import { onSessionEnd } from './sessionLifecycle';
import { supabase } from './client';
const cache = new Map<string, { url: string; expires: number }>();
let generation = 0;
onSessionEnd(() => {
  generation++;
  cache.clear();
});
export function useAvatarUrl(path: string) {
  const [entry, setEntry] = useState<{ path: string; url: string }>();
  useEffect(() => {
    let alive = true;
    const token = generation;
    const client = supabase;
    if (!path.includes('/') || !client) return;
    const resolve = async () => {
      const cached = cache.get(path);
      if (cached && cached.expires > Date.now()) return cached.url;
      const { data } = await client.storage.from('zuno-avatars').createSignedUrl(path, 60);
      if (data && token === generation && alive) {
        cache.set(path, { url: data.signedUrl, expires: Date.now() + 45000 });
        return data.signedUrl;
      }
    };
    void resolve()
      .then((url) => {
        if (alive && url) setEntry({ path, url });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [path]);
  return entry?.path === path ? entry.url : undefined;
}
