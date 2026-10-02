// Loaded only by the __DEV__, web, loopback, opt-in branch in AuthGate.
import { useEffect, useRef, useState, type PropsWithChildren, type ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { normalizePhone, type PhoneAuth } from '../../backend/phoneAuth';
import { endSessionServices } from '../../backend/sessionLifecycle';
import { palette, tokens } from '../../theme/tokens';

const sessionKey = 'zuno.local-phone.session.v1';
const hint =
  'Local phone preview · use any number with a country code and code 000000. No SMS is sent. This opens sample data only.';
function restored() {
  try {
    return window.sessionStorage.getItem(sessionKey) === 'signed-in';
  } catch {
    return false;
  }
}
export function LocalPhonePreview({
  children,
  Welcome,
}: PropsWithChildren<{
  Welcome: ComponentType<{ phoneAuth: PhoneAuth; localHint: string }>;
}>) {
  const [signedIn, setSignedIn] = useState(restored);
  const requested = useRef('');
  useEffect(() => {
    // Retire the old email/PIN preview session and its sample profile.
    try {
      window.sessionStorage.removeItem('zuno.local-test.session.v1');
      window.localStorage.removeItem('zuno.local-test.data.v1');
    } catch {}
  }, []);
  const auth: PhoneAuth = {
    request: async (phone) => {
      const normalized = normalizePhone(phone);
      if (!normalized) throw new Error('Include a valid country code and phone number.');
      requested.current = normalized;
    },
    verify: async (phone, code) => {
      if (!requested.current || requested.current !== normalizePhone(phone) || code !== '000000')
        throw new Error('For this local preview, enter the six-zero test code: 000000.');
      try {
        window.sessionStorage.setItem(sessionKey, 'signed-in');
      } catch {}
      // Never persist the phone/code or create a Supabase session.
      requested.current = '';
      setSignedIn(true);
    },
  };
  if (!signedIn) return <Welcome phoneAuth={auth} localHint={hint} />;
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.banner}>
        <Text style={styles.label}>Local phone preview · sample data</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => {
            endSessionServices();
            try {
              window.sessionStorage.removeItem(sessionKey);
            } catch {}
            requested.current = '';
            setSignedIn(false);
          }}
        >
          <Text style={styles.link}>Sign out of local preview</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: palette.light.accentSoft,
  },
  label: { fontFamily: tokens.font.medium, color: palette.light.ink, fontSize: 12 },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  link: { fontFamily: tokens.font.bold, color: palette.light.accent, fontSize: 13 },
});
