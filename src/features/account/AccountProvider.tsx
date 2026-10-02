import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Linking, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import * as Apple from 'expo-apple-authentication';
import * as Browser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { parseAuthCallback, AUTH_REDIRECT } from '../../backend/authCallback';
import { backendConfig, supabase, revokeLocalSession, beginSignIn } from '../../backend/client';
import { endSessionServices } from '../../backend/sessionLifecycle';
import { onboardingState, type Onboarding } from '../../backend/onboarding';

interface Account {
  session: Session | null;
  ready: boolean;
  error: string;
  busy: boolean;
  onboarding: Onboarding | null;
  loadingProfile: boolean;
  locationEnabled: boolean;
  reloadProfile(): Promise<void>;
  callback(url: string): Promise<void>;
  signIn(provider: 'apple' | 'google' | 'email', email?: string): Promise<boolean>;
  signOut(): Promise<void>;
  finish(visibility: Onboarding['visibility'], enabled: boolean): Promise<void>;
}
const AccountContext = createContext<Account | null>(null);
const appleNameKey = (id: string) => `zuno.apple-name.${id}`;
export function AccountProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const epoch = useRef(0);
  const profileRequest = useRef(0);
  const codes = useRef(new Set<string>());
  const reloadProfile = useCallback(async () => {
    const client = supabase,
      id = sessionRef.current?.user.id,
      token = epoch.current;
    if (!client || !id) return;
    const request = ++profileRequest.current;
    setLoadingProfile(true);
    try {
      let profile = await onboardingState(client);
      if (Platform.OS !== 'web') {
        const name = await SecureStore.getItemAsync(appleNameKey(id));
        if (name && profile.step === 'profile' && !profile.name) {
          const { error: issue } = await client.rpc('zuno_save_onboarding_draft', {
            name,
            username: profile.username,
            bio: profile.bio,
          });
          if (issue) throw issue;
          profile = await onboardingState(client);
        }
        if (name) await SecureStore.deleteItemAsync(appleNameKey(id));
      }
      if (
        token === epoch.current &&
        request === profileRequest.current &&
        id === sessionRef.current?.user.id
      ) {
        setOnboarding(profile);
        setError('');
      }
    } catch {
      if (token === epoch.current && request === profileRequest.current)
        setError(
          'Zuno couldn’t connect. Your session is still saved. Check your connection and retry.',
        );
    } finally {
      if (token === epoch.current && request === profileRequest.current) setLoadingProfile(false);
    }
  }, []);
  const callback = useCallback(async (url: string) => {
    const parsed = parseAuthCallback(url),
      client = supabase;
    if (!parsed || !client) return;
    if ('error' in parsed) {
      setError('This sign-in link expired or was declined. Please try again.');
      return;
    }
    if (codes.current.has(parsed.code)) return;
    codes.current.add(parsed.code);
    const { error: issue } = await client.auth.exchangeCodeForSession(
      parsed.code,
      parsed.flowId ? { flowId: parsed.flowId } : undefined,
    );
    if (issue)
      setError(
        'Sign in couldn’t be completed. Open the latest link on the same iPhone where you requested it.',
      );
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let alive = true,
      received = false;
    const accept = (next: Session | null) => {
      if (!alive) return;
      if (sessionRef.current?.user.id !== next?.user.id) {
        epoch.current++;
        endSessionServices();
        setOnboarding(null);
        setLocationEnabled(false);
        setLoadingProfile(!!next);
      }
      sessionRef.current = next;
      setSession(next);
      setReady(true);
    };
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, next) => {
      received = true;
      accept(next); // No async auth calls inside this listener.
    });
    void client.auth
      .getSession()
      .then(({ data, error: issue }) => {
        if (received || !alive) return;
        accept(data.session);
        if (issue)
          setError('Zuno couldn’t restore your session. Check your connection and try again.');
      })
      .catch(() => {
        if (alive) {
          setReady(true);
          setError('Zuno couldn’t connect. Please try again.');
        }
      });
    const links = Linking.addEventListener('url', ({ url }) => {
      void callback(url).catch(() => setError('Sign in couldn’t be completed. Please try again.'));
    });
    void Linking.getInitialURL()
      .then((url) => {
        if (url && alive) return callback(url);
      })
      .catch(() => undefined);
    const refresh = (state: string) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    if (Platform.OS !== 'web') refresh(AppState.currentState);
    const lifecycle =
      Platform.OS !== 'web' ? AppState.addEventListener('change', refresh) : undefined;
    return () => {
      alive = false;
      subscription.unsubscribe();
      links.remove();
      lifecycle?.remove();
      client.auth.stopAutoRefresh();
    };
  }, [callback]);
  useEffect(() => {
    if (session?.user.id) void reloadProfile();
  }, [session?.user.id, reloadProfile]);
  const signOut = useCallback(async () => {
    const client = supabase;
    if (!client || working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    const id = sessionRef.current?.user.id;
    epoch.current++;
    endSessionServices();
    client.realtime.disconnect();
    client.auth.stopAutoRefresh();
    setSession(null);
    setOnboarding(null);
    setLocationEnabled(false);
    setLoadingProfile(false);
    try {
      // Clearing the server marker is best effort; expired fixes disappear after 90 seconds.
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 1500);
      try {
        await client.rpc('zuno_stop_location').abortSignal(abort.signal);
      } finally {
        clearTimeout(timer);
      }
    } catch {
      /* Local revocation has already happened. */
    }
    try {
      // Installed auth-js removes local storage even when remote logout fails.
      const { error: issue } = await client.auth.signOut({ scope: 'local' });
      await revokeLocalSession();
      // Calling the supported API again with empty storage invalidates in-flight refreshes too.
      await client.auth.signOut({ scope: 'local' });
      if (issue)
        setError(
          'Signed out on this iPhone. The server could not be reached; live location will expire automatically.',
        );
      if (id && Platform.OS !== 'web') await SecureStore.deleteItemAsync(appleNameKey(id));
      sessionRef.current = null;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, []);
  const signIn = async (provider: 'apple' | 'google' | 'email', email?: string) => {
    const client = supabase;
    if (!client || working.current) return false;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      await beginSignIn();
      if (Platform.OS === 'web') throw new Error('ios-only');
      if (provider === 'email') {
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          setError('Enter a valid email address.');
          return false;
        }
        const { error: issue } = await client.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { shouldCreateUser: true, emailRedirectTo: AUTH_REDIRECT },
        });
        if (issue) throw issue;
      } else if (provider === 'apple') {
        const nonce = Crypto.randomUUID() + Crypto.randomUUID();
        const state = Crypto.randomUUID();
        const credential = await Apple.signInAsync({
          nonce: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce),
          state,
          requestedScopes: [
            Apple.AppleAuthenticationScope.FULL_NAME,
            Apple.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken || credential.state !== state)
          throw new Error('apple-response');
        const { data, error: issue } = await client.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce,
        });
        if (issue || !data.user) throw issue ?? new Error('apple-session');
        const name = credential.fullName
          ? Apple.formatFullName(credential.fullName).trim().slice(0, 40)
          : '';
        if (name)
          await SecureStore.setItemAsync(appleNameKey(data.user.id), name, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          });
        await reloadProfile();
      } else {
        const { data, error: issue } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
        });
        if (issue || !data.url) throw issue ?? new Error('google-url');
        const result = await Browser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
        if (result.type !== 'success') return false;
        await callback(result.url);
      }
      return true;
    } catch (issue) {
      if (!(
        issue &&
        typeof issue === 'object' &&
        'code' in issue &&
        issue.code === 'ERR_REQUEST_CANCELED'
      ))
        setError(
          Platform.OS === 'web'
            ? 'Open Zuno on your iPhone to sign in.'
            : provider === 'email'
              ? 'We couldn’t send a sign-in link. Check your address and connection, wait a minute, then try again.'
              : 'Sign in couldn’t be completed. Please try again. This sign-in option may not be available in this beta yet.',
        );
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const finish = async (visibility: Onboarding['visibility'], enabled: boolean) => {
    if (!supabase) return;
    const { error: issue } = await supabase.rpc('zuno_complete_onboarding', { visibility });
    if (issue) throw new Error('Could not save your choice. Check your connection and retry.');
    setLocationEnabled(enabled);
    await reloadProfile();
  };
  return (
    <AccountContext.Provider
      value={{
        session,
        ready,
        error,
        busy,
        onboarding,
        loadingProfile,
        locationEnabled,
        reloadProfile,
        callback,
        signIn,
        signOut,
        finish,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}
export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('AccountProvider required');
  return value;
}
export { backendConfig, supabase };
