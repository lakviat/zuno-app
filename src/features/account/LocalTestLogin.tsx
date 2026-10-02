// Loaded only by the __DEV__ localhost branch in AuthGate. These credentials
// unlock local sample data; they never create or authenticate a Supabase user.
import { useState, type PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../../components/Brand';
import { endSessionServices } from '../../backend/sessionLifecycle';
import { palette, tokens } from '../../theme/tokens';

const sessionKey = 'zuno.local-test.session.v1';
const colors = palette.light;
function restored() {
  try {
    return window.sessionStorage.getItem(sessionKey) === 'signed-in';
  } catch {
    return false;
  }
}
export function LocalTestLogin({ children }: PropsWithChildren) {
  const [step, setStep] = useState<'credentials' | 'code' | 'map'>(() =>
    restored() ? 'map' : 'credentials',
  );
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const signOut = () => {
    endSessionServices();
    try {
      window.sessionStorage.removeItem(sessionKey);
    } catch {}
    setStep('credentials');
    setEmail('');
    setPin('');
    setCode('');
    setError('');
  };
  const submit = () => {
    setError('');
    if (step === 'credentials') {
      if (email.trim().toLowerCase() !== 'testing@test.com' || pin !== '0000') {
        setError('Use the local test email and four-digit PIN shown below.');
        return;
      }
      setPin('');
      setStep('code');
    } else {
      if (code !== '000000') {
        setError('Enter the six-zero test code: 000000.');
        return;
      }
      try {
        window.sessionStorage.setItem(sessionKey, 'signed-in');
      } catch {}
      setCode('');
      setStep('map');
    }
  };
  if (step === 'map')
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Testing · local sample data</Text>
          <Pressable accessibilityRole="button" onPress={signOut} style={styles.signOut}>
            <Text style={styles.link}>Sign out of local test</Text>
          </Pressable>
        </View>
        {children}
      </View>
    );
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Brand />
          <Text accessibilityRole="header" style={styles.title}>
            {step === 'credentials' ? 'Local test sign-in' : 'Verify your test login'}
          </Text>
          <Text style={styles.copy}>
            Explore Zuno with sample people and meetups. Changes stay in this browser; no email is
            sent.
          </Text>
          {step === 'credentials' ? (
            <>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                accessibilityLabel="Test email address"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
              />
              <Text style={styles.label}>PIN</Text>
              <TextInput
                accessibilityLabel="Test PIN"
                secureTextEntry
                keyboardType="number-pad"
                maxLength={4}
                value={pin}
                onChangeText={setPin}
                onSubmitEditing={submit}
                style={styles.input}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                accessibilityLabel="Test verification code"
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                onSubmitEditing={submit}
                style={styles.input}
              />
            </>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <Pressable accessibilityRole="button" onPress={submit} style={styles.button}>
            <Text style={styles.buttonText}>
              {step === 'credentials' ? 'Continue' : 'Open local Zuno'}
            </Text>
          </Pressable>
          {step === 'code' && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setStep('credentials');
                setCode('');
                setError('');
              }}
              style={styles.signOut}
            >
              <Text style={styles.link}>Back to test sign-in</Text>
            </Pressable>
          )}
          <Text style={styles.hint}>Email: testing@test.com{'\n'}PIN: 0000 · Code: 000000</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 14, paddingVertical: 24 },
  title: {
    fontFamily: tokens.font.display,
    fontSize: 30,
    lineHeight: 36,
    color: colors.ink,
    marginTop: 10,
  },
  copy: { fontFamily: tokens.font.body, fontSize: 15, lineHeight: 22, color: colors.muted },
  label: { fontFamily: tokens.font.bold, fontSize: 14, color: colors.ink },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: tokens.font.body,
    color: colors.ink,
  },
  button: {
    minHeight: 54,
    backgroundColor: colors.accent,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  buttonText: { color: '#fff', fontFamily: tokens.font.bold, fontSize: 16 },
  error: { color: '#AC3925', fontFamily: tokens.font.body, lineHeight: 21 },
  hint: { fontFamily: tokens.font.body, color: colors.muted, fontSize: 13, lineHeight: 21 },
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: colors.accentSoft,
  },
  bannerText: { fontFamily: tokens.font.medium, color: colors.ink, fontSize: 12 },
  signOut: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  link: { fontFamily: tokens.font.bold, color: colors.accent, fontSize: 13 },
});
