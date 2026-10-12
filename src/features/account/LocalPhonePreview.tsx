// Loaded only by AuthGate's explicit development preview branch. Never hosted Auth.
import { useEffect, useRef, useState, type PropsWithChildren, type ComponentType } from 'react';
import { ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizePhone, type PhoneAuth } from '../../backend/phoneAuth';
import { endSessionServices } from '../../backend/sessionLifecycle';
import { palette } from '../../theme/tokens';
import { PreviewSessionContext } from './PreviewSessionContext';

const sessionKey = 'zuno.local-phone.session.v1';
const hint =
  'Phone test mode · enter any 10-digit US number, then 000000. No SMS is sent. This opens sample data only.';
// A marker only: never persist the phone, verification code, or a Supabase token.
const storage = {
  async read() {
    try {
      return (
        (Platform.OS === 'web'
          ? window.sessionStorage.getItem(sessionKey)
          : await AsyncStorage.getItem(sessionKey)) === 'signed-in'
      );
    } catch {
      return false;
    }
  },
  async write(signedIn: boolean) {
    try {
      if (Platform.OS === 'web') {
        if (signedIn) window.sessionStorage.setItem(sessionKey, 'signed-in');
        else window.sessionStorage.removeItem(sessionKey);
      } else if (signedIn) await AsyncStorage.setItem(sessionKey, 'signed-in');
      else await AsyncStorage.removeItem(sessionKey);
    } catch {
      /* Local sample mode can still run without persistent storage. */
    }
  },
};
export function LocalPhonePreview({
  children,
  Welcome,
}: PropsWithChildren<{
  Welcome: ComponentType<{ phoneAuth: PhoneAuth; localHint: string }>;
}>) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const requested = useRef('');
  useEffect(() => {
    let alive = true;
    void storage.read().then((restored) => {
      if (alive) {
        setSignedIn(restored);
        setReady(true);
      }
    });
    // Retire the old browser email/PIN preview only; never touch real auth storage.
    if (Platform.OS === 'web') {
      try {
        window.sessionStorage.removeItem('zuno.local-test.session.v1');
        window.localStorage.removeItem('zuno.local-test.data.v1');
      } catch {}
    }
    return () => {
      alive = false;
    };
  }, []);
  const auth: PhoneAuth = {
    request: async (phone) => {
      const normalized = normalizePhone(phone);
      if (!normalized)
        throw new Error('Enter a 10-digit US number, or include an international country code.');
      requested.current = normalized;
    },
    verify: async (phone, code) => {
      if (!requested.current || requested.current !== normalizePhone(phone) || code !== '000000')
        throw new Error('For this phone test, enter the six-zero test code: 000000.');
      await storage.write(true);
      requested.current = '';
      setSignedIn(true);
    },
  };
  if (!ready)
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator accessibilityLabel="Opening phone preview" />
      </SafeAreaView>
    );
  if (!signedIn) return <Welcome phoneAuth={auth} localHint={hint} />;
  return (
    <PreviewSessionContext.Provider
      value={{
        signOut: async () => {
          endSessionServices();
          requested.current = '';
          await storage.write(false);
          setSignedIn(false);
        },
      }}
    >
      {children}
    </PreviewSessionContext.Provider>
  );
}
const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', backgroundColor: palette.light.background },
});
