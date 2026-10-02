import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { startupRoute } from '../../backend/onboarding';
import { AccountProvider, useAccount } from './AccountProvider';
import { onSessionEnd } from '../../backend/sessionLifecycle';
const m = vi.hoisted(() => ({
  session: null as Session | null,
  listener: ((_event: string, _session: Session | null) => {}) as (
    event: string,
    session: Session | null,
  ) => void,
  rpc: vi.fn(),
  apple: vi.fn(),
  oauth: vi.fn(),
  otp: vi.fn(),
  verify: vi.fn(),
  idToken: vi.fn(),
  exchange: vi.fn(),
  logout: vi.fn(),
  browser: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
  disconnect: vi.fn(),
  stop: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  Linking: { addEventListener: () => ({ remove() {} }), getInitialURL: async () => null },
}));
vi.mock('expo-apple-authentication', () => ({
  signInAsync: m.apple,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  formatFullName: (name: { givenName: string }) => name.givenName,
}));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync: m.browser }));
vi.mock('expo-crypto', () => ({
  randomUUID: () => 'random-state',
  digestStringAsync: async () => 'hashed-nonce',
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: m.get,
  setItemAsync: m.put,
  deleteItemAsync: m.remove,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
}));
vi.mock('../../backend/client', () => ({
  backendConfig: { status: 'configured' },
  revokeLocalSession: async () => {},
  beginSignIn: async () => {},
  supabase: {
    auth: {
      onAuthStateChange: (callback: typeof m.listener) => {
        m.listener = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession: async () => ({ data: { session: m.session }, error: null }),
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: m.stop,
      exchangeCodeForSession: m.exchange,
      signInWithIdToken: m.idToken,
      signInWithOAuth: m.oauth,
      signInWithOtp: m.otp,
      verifyOtp: m.verify,
      signOut: m.logout,
    },
    rpc: (name: string, args: unknown) => {
      const promise = Promise.resolve().then(() => m.rpc(name, args));
      return Object.assign(promise, { abortSignal: () => promise });
    },
    realtime: { disconnect: m.disconnect },
  },
}));
let account: ReturnType<typeof useAccount>;
let tree: ReactTestRenderer;
const A = { user: { id: 'account-a' }, access_token: 'unit-fixture-a' } as Session;
const B = { user: { id: 'account-b' }, access_token: 'unit-fixture-b' } as Session;
const profile = {
  step: 'profile',
  completedAt: null,
  name: '',
  username: '',
  bio: '',
  avatar: null,
  visibility: 'private',
};
function Probe() {
  const value = useAccount();
  React.useLayoutEffect(() => {
    account = value;
  }, [value]);
  return null;
}
async function mount() {
  await act(async () => {
    tree = create(
      <AccountProvider>
        <Probe />
      </AccountProvider>,
    );
  });
}
async function emit(session: Session | null, event = 'SIGNED_IN') {
  await act(async () => {
    m.session = session;
    m.listener(event, session);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  m.session = null;
  m.rpc.mockImplementation(async (name: string) => ({
    data: name === 'zuno_onboarding_state' ? profile : null,
    error: null,
  }));
  m.get.mockResolvedValue(null);
  m.put.mockResolvedValue(undefined);
  m.remove.mockResolvedValue(undefined);
  m.apple.mockResolvedValue({
    identityToken: 'unit-only-token',
    state: 'random-state',
    fullName: { givenName: 'First Name' },
  });
  m.idToken.mockImplementation(async () => {
    m.session = A;
    m.listener('SIGNED_IN', A);
    return { data: { user: A.user }, error: null };
  });
  m.oauth.mockResolvedValue({
    data: { url: 'https://accounts.google.com/unit-fixture' },
    error: null,
  });
  m.browser.mockResolvedValue({ type: 'success', url: 'zuno://auth/callback?code=valid-code-123' });
  m.exchange.mockImplementation(async () => {
    m.session = A;
    m.listener('SIGNED_IN', A);
    return { error: null };
  });
  m.otp.mockResolvedValue({ error: null });
  m.verify.mockImplementation(async () => {
    m.session = A;
    m.listener('SIGNED_IN', A);
    return { data: { session: A }, error: null };
  });
  m.logout.mockImplementation(async () => {
    m.session = null;
    m.listener('SIGNED_OUT', null);
    return { error: null };
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
describe('central account lifecycle (mocked provider/device boundary)', () => {
  it('AUTH-01 captures the first Apple name without storing an Apple credential', async () => {
    await mount();
    await act(async () => {
      await account.signIn('apple');
    });
    expect(m.put).toHaveBeenCalledWith(
      'zuno.apple-name.account-a',
      'First Name',
      expect.anything(),
    );
    expect(m.idToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'unit-only-token',
      nonce: 'random-staterandom-state',
    });
  });
  it('AUTH-02 returning Apple without a name leaves the saved profile untouched', async () => {
    m.apple.mockResolvedValue({ identityToken: 'token', state: 'random-state', fullName: null });
    await mount();
    await act(async () => {
      await account.signIn('apple');
    });
    expect(m.put).not.toHaveBeenCalled();
    expect(account.session?.user.id).toBe('account-a');
  });
  it('AUTH-03 Apple cancellation is quiet', async () => {
    m.apple.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    await mount();
    await act(async () => {
      await account.signIn('apple');
    });
    expect(account.error).toBe('');
    expect(account.session).toBeNull();
  });
  it('AUTH-04 Google uses browser PKCE and returns to the exact app callback', async () => {
    await mount();
    await act(async () => {
      await account.signIn('google');
    });
    expect(m.oauth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'zuno://auth/callback', skipBrowserRedirect: true },
    });
    expect(account.session?.user.id).toBe('account-a');
  });
  it('AUTH-05 completed returning Google goes to map', async () => {
    m.rpc.mockResolvedValue({
      data: { ...profile, step: 'complete', completedAt: '2026-10-01' },
      error: null,
    });
    await mount();
    await act(async () => {
      await account.signIn('google');
    });
    expect(
      startupRoute(account.ready, !!account.session, account.loadingProfile, account.onboarding),
    ).toBe('map');
  });
  it('AUTH-06 Google cancel does not exchange a code or show an error', async () => {
    m.browser.mockResolvedValue({ type: 'cancel' });
    await mount();
    await act(async () => {
      await account.signIn('google');
    });
    expect(m.exchange).not.toHaveBeenCalled();
    expect(account.error).toBe('');
  });
  it('AUTH-07 email supports signup and login with a same-device callback', async () => {
    await mount();
    await act(async () => {
      await account.signIn('email', ' Person@Example.com ');
    });
    expect(m.otp).toHaveBeenCalledWith({
      email: 'person@example.com',
      options: { shouldCreateUser: true, emailRedirectTo: 'zuno://auth/callback' },
    });
  });
  it('rejects invalid email before contacting auth', async () => {
    await mount();
    await act(async () => {
      await account.signIn('email', 'bad');
    });
    expect(m.otp).not.toHaveBeenCalled();
    expect(account.error).toContain('valid email');
  });
  it('phone code request stays signed out; verified phone resumes onboarding', async () => {
    await mount();
    await act(async () => {
      await account.phoneAuth.request('+1 202 555 0123');
    });
    expect(account.session).toBeNull();
    await act(async () => {
      await account.phoneAuth.verify('+12025550123', '123456');
    });
    expect(account.session?.user.id).toBe('account-a');
    expect(
      startupRoute(account.ready, !!account.session, account.loadingProfile, account.onboarding),
    ).toBe('profile');
    expect(account.busy).toBe(false);
  });
  it('invalid phone OTP leaves the account signed out and retryable', async () => {
    m.verify.mockResolvedValue({ data: { session: null }, error: { code: 'otp_expired' } });
    await mount();
    await act(async () => {
      await expect(account.phoneAuth.verify('+12025550123', '000000')).rejects.toThrow();
    });
    expect(account.session).toBeNull();
    expect(account.busy).toBe(false);
  });
  it('serializes phone sends to prevent double-tap SMS requests', async () => {
    await mount();
    await act(async () => {
      const pending = account.phoneAuth.request('+12025550123');
      await expect(account.phoneAuth.request('+12025550123')).rejects.toThrow('wait');
      await pending;
    });
    expect(m.otp).toHaveBeenCalledTimes(1);
  });
  it('AUTH-08 restored incomplete account resumes saved location stage', async () => {
    m.session = A;
    m.rpc.mockResolvedValue({ data: { ...profile, step: 'location' }, error: null });
    await mount();
    expect(startupRoute(account.ready, true, account.loadingProfile, account.onboarding)).toBe(
      'location',
    );
  });
  it('AUTH-09 completed restored account does not see welcome', async () => {
    m.session = A;
    m.rpc.mockResolvedValue({
      data: { ...profile, step: 'complete', completedAt: '2026-10-01' },
      error: null,
    });
    await mount();
    expect(startupRoute(account.ready, true, account.loadingProfile, account.onboarding)).toBe(
      'map',
    );
    expect(m.oauth).not.toHaveBeenCalled();
  });
  it('AUTH-10 offline profile fetch keeps the saved auth session and offers retry', async () => {
    m.session = A;
    m.rpc.mockRejectedValue(new Error('offline'));
    await mount();
    expect(account.session?.user.id).toBe('account-a');
    expect(startupRoute(account.ready, true, account.loadingProfile, account.onboarding)).toBe(
      'retry',
    );
    expect(m.logout).not.toHaveBeenCalled();
  });
  it('AUTH-11 accepted location activates only after saved onboarding', async () => {
    m.session = A;
    await mount();
    await act(async () => {
      await account.finish('friends', true);
    });
    expect(m.rpc).toHaveBeenCalledWith('zuno_complete_onboarding', { visibility: 'friends' });
    expect(account.locationEnabled).toBe(true);
  });
  it('AUTH-12 denied location may complete setup without activation', async () => {
    m.session = A;
    await mount();
    await act(async () => {
      await account.finish('private', false);
    });
    expect(account.locationEnabled).toBe(false);
  });
  it('AUTH-16/17 stops services before any signout network request, including offline', async () => {
    m.session = A;
    await mount();
    const order: string[] = [];
    const off = onSessionEnd(() => order.push('stop-gps-and-channels'));
    m.rpc.mockImplementation(async () => {
      order.push('stop-marker');
      return { data: null, error: null };
    });
    m.logout.mockImplementation(async () => {
      order.push('logout');
      m.listener('SIGNED_OUT', null);
      return { error: new Error('offline') };
    });
    await act(async () => {
      await account.signOut();
    });
    off();
    expect(order[0]).toBe('stop-gps-and-channels');
    expect(order.indexOf('logout')).toBeGreaterThan(order.indexOf('stop-marker'));
    expect(account.session).toBeNull();
    expect(m.disconnect).toHaveBeenCalled();
  });
  it('AUTH-18 switching accounts clears A profile before loading B', async () => {
    m.session = A;
    m.rpc.mockResolvedValue({ data: { ...profile, name: 'Alice' }, error: null });
    await mount();
    await act(async () => {
      await account.signOut();
    });
    m.rpc.mockResolvedValue({ data: { ...profile, name: 'Bob' }, error: null });
    await emit(B);
    expect(account.onboarding?.name).toBe('Bob');
    expect(account.session?.user.id).toBe('account-b');
  });
  it('AUTH-19 invalid session stops services and routes to welcome', async () => {
    m.session = A;
    await mount();
    const stop = vi.fn();
    const off = onSessionEnd(stop);
    await emit(null, 'SIGNED_OUT');
    off();
    expect(stop).toHaveBeenCalled();
    expect(startupRoute(account.ready, false, account.loadingProfile, account.onboarding)).toBe(
      'welcome',
    );
  });
  it('deduplicates warm/cold/browser callbacks', async () => {
    await mount();
    await act(async () => {
      await Promise.all([
        account.callback('zuno://auth/callback?code=valid-code-123'),
        account.callback('zuno://auth/callback?code=valid-code-123'),
      ]);
    });
    expect(m.exchange).toHaveBeenCalledTimes(1);
  });
  it('ignores callbacks to foreign hosts and fragment tokens', async () => {
    await mount();
    await act(async () => {
      await account.callback('https://evil.example/callback?code=valid-code-123');
      await account.callback('zuno://auth/callback#access_token=secret');
    });
    expect(m.exchange).not.toHaveBeenCalled();
  });
  it('prevents repeated taps from starting concurrent sign-ins', async () => {
    await mount();
    await act(async () => {
      await Promise.all([account.signIn('apple'), account.signIn('apple')]);
    });
    expect(m.apple).toHaveBeenCalledTimes(1);
  });
});
