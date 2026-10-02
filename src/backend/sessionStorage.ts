export interface SecretStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
const CHUNK = 1000;
const MAX_CHUNKS = 128;
type Index = { generation: string; count: number };
function index(raw: string | null): Index | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Index;
    return /^[a-z0-9-]+$/.test(value.generation) &&
      Number.isInteger(value.count) &&
      value.count > 0 &&
      value.count <= MAX_CHUNKS
      ? value
      : null;
  } catch {
    return null;
  }
}
/** Keychain items stay below SecureStore's per-item limit. Commit the index last. */
export function chunkedSessionStorage(store: SecretStorage): SecretStorage {
  let queue = Promise.resolve<unknown>(undefined);
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.catch(() => undefined).then(work);
    queue = next;
    return next;
  };
  const part = (key: string, idx: Index, i: number) => `${key}.${idx.generation}.${i}`;
  const removeParts = async (key: string, idx: Index | null) => {
    if (idx)
      await Promise.all(
        Array.from({ length: idx.count }, (_, i) => store.removeItem(part(key, idx, i))),
      );
  };
  return {
    getItem: (key) =>
      serialize(async () => {
        const idx = index(await store.getItem(key));
        if (!idx) return null;
        const parts = await Promise.all(
          Array.from({ length: idx.count }, (_, i) => store.getItem(part(key, idx, i))),
        );
        // Partial/corrupt credentials are never returned as a session.
        return parts.some((value) => value === null) ? null : parts.join('');
      }),
    setItem: (key, value) =>
      serialize(async () => {
        // Encode to ASCII, so chunk size is a byte limit even for Unicode metadata.
        const encoded = encodeURIComponent(value);
        const count = Math.ceil(encoded.length / CHUNK);
        if (!count || count > MAX_CHUNKS)
          throw new Error('Session is too large to store securely.');
        const previous = index(await store.getItem(key));
        const next = {
          generation: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
          count,
        };
        try {
          for (let i = 0; i < count; i++)
            await store.setItem(part(key, next, i), encoded.slice(i * CHUNK, (i + 1) * CHUNK));
          await store.setItem(key, JSON.stringify(next));
        } catch (error) {
          await removeParts(key, next).catch(() => undefined);
          throw error;
        }
        await removeParts(key, previous).catch(() => undefined);
      }),
    removeItem: (key) =>
      serialize(async () => {
        const idx = index(await store.getItem(key));
        await store.removeItem(key);
        await removeParts(key, idx);
      }),
  };
}
export function decodedSessionStorage(store: SecretStorage): SecretStorage {
  const chunks = chunkedSessionStorage(store);
  return {
    ...chunks,
    getItem: async (key) => {
      const raw = await chunks.getItem(key);
      if (raw === null) return null;
      try {
        return decodeURIComponent(raw);
      } catch {
        return null;
      }
    },
  };
}

/** An explicit logout survives an offline refresh failure and any late credential writes. */
export function revocableSessionStorage(store: SecretStorage, sessionKey: string) {
  const marker = `${sessionKey}.signed-out`;
  let revoked = false;
  const storage: SecretStorage = {
    getItem: async (key) => (revoked || (await store.getItem(marker)) ? null : store.getItem(key)),
    setItem: async (key, value) => {
      if (!revoked && !(await store.getItem(marker))) await store.setItem(key, value);
    },
    removeItem: (key) => store.removeItem(key),
  };
  return {
    storage,
    async revoke() {
      revoked = true;
      await store.setItem(marker, 'true');
      await Promise.all(
        [sessionKey, `${sessionKey}-code-verifier`, `${sessionKey}-user`].map((key) =>
          store.removeItem(key),
        ),
      );
    },
    async beginSignIn() {
      await store.removeItem(marker);
      revoked = false;
    },
  };
}
