import 'react-native-url-polyfill/auto';
import './crypto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, processLock } from '@supabase/supabase-js';
import { allowLocalTestLogin, backendConfiguration } from './config';
import { decodedSessionStorage, revocableSessionStorage } from './sessionStorage';

export const localTestLoginEnabled =
  __DEV__ &&
  allowLocalTestLogin({
    development: __DEV__,
    platform: Platform.OS,
    hostname: typeof window !== 'undefined' ? (window.location?.hostname ?? '') : '',
    flag: process.env.EXPO_PUBLIC_LOCAL_TEST_LOGIN,
  });
export const backendConfig = localTestLoginEnabled
  ? { status: 'unconfigured' as const }
  : backendConfiguration(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
const memory = new Map<string, string>();
const storage =
  Platform.OS === 'web'
    ? {
        getItem: async (key: string) => memory.get(key) ?? null,
        setItem: async (key: string, value: string) => {
          memory.set(key, value);
        },
        removeItem: async (key: string) => {
          memory.delete(key);
        },
      }
    : decodedSessionStorage({
        getItem: SecureStore.getItemAsync,
        setItem: (key, value) =>
          SecureStore.setItemAsync(key, value, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }),
        removeItem: SecureStore.deleteItemAsync,
      });

const sessionKey =
  backendConfig.status === 'configured'
    ? `sb-${new URL(backendConfig.url).hostname.split('.')[0]}-auth-token`
    : 'zuno-unconfigured';
const sessionStorage = revocableSessionStorage(storage, sessionKey);
export const revokeLocalSession = () => sessionStorage.revoke();
export const beginSignIn = () => sessionStorage.beginSignIn();
// Bound network time prevents a broken connection from trapping bootstrap/sign-out.
const timedFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  init?.signal?.addEventListener('abort', abort);
  if (init?.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, String(input).includes('/logout') ? 4000 : 12000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener('abort', abort);
  }
};
export const supabase =
  backendConfig.status === 'configured'
    ? createClient(backendConfig.url, backendConfig.publishableKey, {
        global: { fetch: timedFetch },
        auth: {
          storage: sessionStorage.storage,
          storageKey: sessionKey,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
          lock: processLock,
        },
      })
    : null;
