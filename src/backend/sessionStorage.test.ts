import { describe, expect, it } from 'vitest';
import { decodedSessionStorage, type SecretStorage } from './sessionStorage';
function fixture() {
  const data = new Map<string, string>();
  const raw: SecretStorage = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
  return { data, raw, store: decodedSessionStorage(raw) };
}
describe('iOS session persistence', () => {
  it('round-trips large Unicode credentials without exceeding Keychain item sizes', async () => {
    const { data, store } = fixture();
    const value = JSON.stringify({
      access_token: 'x'.repeat(7000),
      user: { name: '🌍 София'.repeat(100) },
    });
    await store.setItem('auth', value);
    expect(await store.getItem('auth')).toBe(value);
    expect([...data.values()].every((v) => Buffer.byteLength(v) <= 1000)).toBe(true);
    await store.removeItem('auth');
    expect(data.size).toBe(0);
    expect(await store.getItem('auth')).toBeNull();
  });
  it('preserves the old credential if a replacement cannot be written', async () => {
    const { data, raw, store } = fixture();
    await store.setItem('auth', 'previous');
    const oldKeys = [...data.keys()];
    let writes = 0;
    const failing = decodedSessionStorage({
      ...raw,
      setItem: async (k, v) => {
        if (++writes === 2) throw Error('Keychain locked');
        await raw.setItem(k, v);
      },
    });
    await expect(failing.setItem('auth', 'x'.repeat(4000))).rejects.toThrow();
    expect(await store.getItem('auth')).toBe('previous');
    expect([...data.keys()].sort()).toEqual(oldKeys.sort());
  });
  it('serializes replacement and sign-out, removing every fragment', async () => {
    const { data, store } = fixture();
    await Promise.all([
      store.setItem('auth', 'first'),
      store.setItem('auth', 'second'),
      store.removeItem('auth'),
    ]);
    expect(data.size).toBe(0);
  });
  it('never returns a partially missing token', async () => {
    const { data, store } = fixture();
    await store.setItem('auth', 'a'.repeat(5000));
    data.delete([...data.keys()].find((k) => k !== 'auth')!);
    expect(await store.getItem('auth')).toBeNull();
  });
});

describe('explicit offline logout', () => {
  it('revokes persisted sessions and ignores late writes across restart until new sign-in', async () => {
    const { store } = fixture();
    const { revocableSessionStorage } = await import('./sessionStorage');
    const first = revocableSessionStorage(store, 'auth');
    await first.storage.setItem('auth', 'user-a');
    await first.storage.setItem('auth-code-verifier', 'verifier');
    await first.revoke();
    await first.storage.setItem('auth', 'late-refresh-for-a');
    expect(await first.storage.getItem('auth')).toBeNull();
    const restarted = revocableSessionStorage(store, 'auth');
    expect(await restarted.storage.getItem('auth')).toBeNull();
    expect(await store.getItem('auth-code-verifier')).toBeNull();
    await restarted.beginSignIn();
    await restarted.storage.setItem('auth', 'user-b');
    expect(await restarted.storage.getItem('auth')).toBe('user-b');
  });
});
