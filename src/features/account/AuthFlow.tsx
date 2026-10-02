import { Brand } from '../../components/Brand';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Apple from 'expo-apple-authentication';
import * as Location from 'expo-location';
import { palette, tokens } from '../../theme/tokens';
import {
  validUsername,
  normalizeUsername,
  startupRoute,
  type Onboarding,
  type Visibility,
} from '../../backend/onboarding';
import { pickAvatar } from '../../backend/avatarUpload';
import { useAvatarUrl } from '../../backend/useAvatarUrl';
import { useAccount, backendConfig, supabase } from './AccountProvider';
import { localTestLoginEnabled } from '../../backend/client';
const colors = palette.light;
function Copy({ children, title = false }: PropsWithChildren<{ title?: boolean }>) {
  return <Text style={title ? styles.title : styles.copy}>{children}</Text>;
}
function Action({
  children,
  onPress,
  disabled = false,
  quiet = false,
}: PropsWithChildren<{ onPress(): void; disabled?: boolean; quiet?: boolean }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, quiet && styles.quiet, disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.buttonText, quiet && { color: colors.ink }]}>{children}</Text>
    </Pressable>
  );
}
function Input({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}
function Frame({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <View style={{ marginBottom: 12 }}>
              <Brand />
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function Welcome() {
  const account = useAccount();
  const [emailFlow, setEmailFlow] = useState(false),
    [email, setEmail] = useState(''),
    [sent, setSent] = useState(false),
    [resendAt, setResendAt] = useState(0),
    [now, setNow] = useState(Date.now),
    [apple, setApple] = useState(false);
  useEffect(() => {
    void Apple.isAvailableAsync()
      .then(setApple)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!resendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  const send = async () => {
    if (await account.signIn('email', email)) {
      setSent(true);
      setResendAt(Date.now() + 60000);
      setNow(Date.now());
    }
  };
  return (
    <Frame>
      {!emailFlow && (
        <>
          <Copy title>Your people. A little closer.</Copy>
          <Copy>Find your friends, share a moment, and make a plan.</Copy>
        </>
      )}
      {!emailFlow ? (
        <>
          {apple ? (
            <View
              pointerEvents={account.busy ? 'none' : 'auto'}
              style={{ opacity: account.busy ? 0.5 : 1 }}
            >
              <Apple.AppleAuthenticationButton
                buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={Apple.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={18}
                style={{ height: 54, width: '100%' }}
                onPress={() => void account.signIn('apple')}
              />
            </View>
          ) : (
            <Action quiet disabled={account.busy} onPress={() => void account.signIn('apple')}>
              Continue with Apple
            </Action>
          )}
          <Action quiet disabled={account.busy} onPress={() => void account.signIn('google')}>
            Continue with Google
          </Action>
          <Action disabled={account.busy} onPress={() => setEmailFlow(true)}>
            Continue with Email
          </Action>
        </>
      ) : (
        <>
          <Copy title>{sent ? 'Check your email' : 'Your email, and you’re in.'}</Copy>
          <Input
            label="Email address"
            value={email}
            onChangeText={setEmail}
            editable={!account.busy && !sent}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
          />
          <Copy>
            {sent
              ? 'If a link can be delivered, you’ll receive it shortly. Open the latest link on this same iPhone.'
              : 'We’ll email you a sign-in link. This works for new and existing accounts.'}
          </Copy>
          <Action
            disabled={account.busy || now < resendAt || !/^\S+@\S+\.\S+$/.test(email.trim())}
            onPress={() => void send()}
          >
            {account.busy
              ? 'Sending…'
              : now < resendAt
                ? `Resend in ${Math.ceil((resendAt - now) / 1000)}s`
                : sent
                  ? 'Send another link'
                  : 'Send sign-in link'}
          </Action>
          <Action
            quiet
            disabled={account.busy}
            onPress={() => {
              setEmailFlow(false);
              setSent(false);
            }}
          >
            Back
          </Action>
        </>
      )}
      {account.busy && <ActivityIndicator color={colors.accent} accessibilityLabel="Signing in" />}
      {!!account.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {account.error}
        </Text>
      )}
      <View style={styles.row}>
        {[
          ['Terms', process.env.EXPO_PUBLIC_TERMS_URL],
          ['Privacy', process.env.EXPO_PUBLIC_PRIVACY_URL],
        ].map(([label, url]) =>
          url?.startsWith('https://') ? (
            <Pressable
              key={label}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(url)}
            >
              <Text style={styles.link}>{label}</Text>
            </Pressable>
          ) : null,
        )}
      </View>
    </Frame>
  );
}
function Setup({ profile }: { profile: Onboarding }) {
  const account = useAccount();
  const [name, setName] = useState(profile.name),
    [username, setUsername] = useState(profile.username),
    [bio, setBio] = useState(profile.bio),
    [avatar, setAvatar] = useState(profile.avatar),
    [visibility, setVisibility] = useState<Visibility>(profile.visibility),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [available, setAvailable] = useState<boolean | null>(null),
    [permission, setPermission] = useState<Location.LocationPermissionResponse | null>(null),
    [back, setBack] = useState(false);
  const photo = useAvatarUrl(avatar ?? '');
  const working = useRef(false);
  const draftQueue = useRef(Promise.resolve());
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const editProfile = profile.step === 'profile' || back;
  useEffect(() => {
    const read = () =>
      void Location.getForegroundPermissionsAsync()
        .then((p) => {
          if (mounted.current) setPermission(p);
        })
        .catch(() => undefined);
    read();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') read();
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!editProfile || !supabase) return;
    let alive = true;
    const client = supabase;
    const timer = setTimeout(() => {
      void client
        .rpc('zuno_username_available', { candidate: normalizeUsername(username) })
        .then(({ data, error: issue }) => {
          if (alive) setAvailable(issue ? null : data === true);
        });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [username, editProfile]);
  useEffect(() => {
    if (!editProfile || working.current || !supabase) return;
    const client = supabase;
    const timer = setTimeout(() => {
      draftQueue.current = draftQueue.current.then(async () => {
        if (!mounted.current || working.current) return;
        const { error: issue } = await client.rpc('zuno_save_onboarding_draft', {
          name,
          username,
          bio,
        });
        if (issue && mounted.current)
          setError('Your draft couldn’t be saved yet. Reconnect before continuing.');
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [name, username, bio, editProfile]);
  const perform = async (work: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      await draftQueue.current;
      await work();
    } catch (issue) {
      if (mounted.current)
        setError(issue instanceof Error ? issue.message : 'Could not save. Please try again.');
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const save = () =>
    void perform(async () => {
      const { error: issue } = await supabase!.rpc('zuno_onboarding_profile', {
        name: name.trim(),
        username: normalizeUsername(username),
        bio: bio.trim(),
        avatar,
      });
      if (issue)
        throw new Error(
          issue.code === '23505'
            ? 'That username is taken. Choose another.'
            : 'Could not save your profile. Check your details and connection.',
        );
      setBack(false);
      await account.reloadProfile();
    });
  const upload = () =>
    void perform(async () => {
      const path = await pickAvatar(account.session!.user.id);
      if (!path) return;
      const { error: issue } = await supabase!.rpc('zuno_save_profile', {
        display_name: profile.name || 'New friend',
        avatar_path: path,
      });
      if (issue) throw new Error('Your photo couldn’t be saved. You can continue without it.');
      setAvatar(path);
    });
  const finish = (request: boolean) =>
    void perform(async () => {
      let next = permission;
      if (request) {
        next = await Location.getForegroundPermissionsAsync();
        if (next.status !== 'granted' && next.canAskAgain)
          next = await Location.requestForegroundPermissionsAsync();
        setPermission(next);
      }
      await account.finish(visibility, request && next?.status === 'granted');
    });
  return (
    <Frame>
      <Copy title>{editProfile ? 'Welcome to Zuno' : 'Your location on Zuno'}</Copy>
      {editProfile ? (
        <>
          <Copy>Just a name and a username. You can add the rest later.</Copy>
          {photo && (
            <Image
              source={{ uri: photo }}
              accessibilityLabel="Your profile photo"
              style={{ width: 76, height: 76, borderRadius: 38, alignSelf: 'center' }}
            />
          )}
          <Action quiet disabled={busy} onPress={upload}>
            {avatar ? 'Change photo' : 'Add a photo (optional)'}
          </Action>
          <Input
            label="Display name"
            value={name}
            onChangeText={setName}
            maxLength={40}
            editable={!busy}
            autoComplete="name"
          />
          <Input
            label="Username"
            value={username}
            onChangeText={(value) => {
              setUsername(value.toLowerCase());
              setAvailable(null);
            }}
            maxLength={40}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
          <Copy>
            {!validUsername(username)
              ? '3–40 letters, numbers or underscores.'
              : available === false
                ? 'That username is taken.'
                : available === true
                  ? 'This username is available.'
                  : 'Checking username…'}
          </Copy>
          <Input
            label="Short bio (optional)"
            value={bio}
            onChangeText={setBio}
            maxLength={160}
            editable={!busy}
          />
          <Action
            disabled={busy || !name.trim() || !validUsername(username) || available === false}
            onPress={save}
          >
            {busy ? 'Saving…' : 'Continue'}
          </Action>
        </>
      ) : (
        <>
          <Copy>
            See nearby people and meetups. Location updates while Zuno is open. You decide who can
            see you.
          </Copy>
          {(['private', 'friends', 'public'] as const).map((mode) => (
            <Pressable
              key={mode}
              disabled={busy}
              accessibilityRole="radio"
              accessibilityState={{ checked: visibility === mode }}
              accessibilityLabel={mode}
              onPress={() => setVisibility(mode)}
              style={[
                styles.choice,
                visibility === mode && {
                  borderColor: colors.accent,
                  backgroundColor: colors.accentSoft,
                },
              ]}
            >
              <Text style={styles.label}>
                {visibility === mode ? '●' : '○'}{' '}
                {mode === 'private' ? 'Private' : mode === 'friends' ? 'Friends' : 'Public'}
              </Text>
              <Copy>
                {mode === 'private'
                  ? 'Explore without sharing your location.'
                  : mode === 'friends'
                    ? 'Share with accepted friends only.'
                    : 'Be discoverable by nearby Zuno users.'}
              </Copy>
            </Pressable>
          ))}
          {permission?.status === 'denied' && (
            <Copy>
              Location is off. You can still explore and join meetups. Nearby discovery and live
              sharing will be limited.
            </Copy>
          )}
          {permission?.canAskAgain === false && permission.status !== 'granted' ? (
            <Action quiet onPress={() => void Linking.openSettings()}>
              Open Settings
            </Action>
          ) : (
            <Action disabled={busy} onPress={() => finish(true)}>
              {busy
                ? 'Saving…'
                : permission?.status === 'granted'
                  ? 'Use location & continue'
                  : 'Enable location & continue'}
            </Action>
          )}
          <Action quiet disabled={busy} onPress={() => finish(false)}>
            Continue without location
          </Action>
          <Action quiet disabled={busy} onPress={() => setBack(true)}>
            Back to profile
          </Action>
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Action quiet disabled={busy || account.busy} onPress={() => void account.signOut()}>
        Use a different account
      </Action>
    </Frame>
  );
}
export function AuthGate({ children }: PropsWithChildren) {
  const a = useAccount();
  if (__DEV__ && localTestLoginEnabled) {
    // Keep the fixture module out of production bundles, including its credentials.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LocalTestLogin } = require('./LocalTestLogin') as typeof import('./LocalTestLogin');
    return <LocalTestLogin>{children}</LocalTestLogin>;
  }
  if (backendConfig.status === 'unconfigured' && __DEV__) return children;
  if (backendConfig.status !== 'configured')
    return (
      <Frame>
        <Copy title>Zuno isn’t connected yet</Copy>
        <Copy>
          This build needs its account connection configured. Please use the next beta build.
        </Copy>
      </Frame>
    );
  const route = startupRoute(
    a.ready,
    !!a.session,
    a.loadingProfile || (a.busy && !!a.session),
    a.onboarding,
  );
  if (route === 'loading')
    return (
      <Frame>
        <ActivityIndicator size="large" color={colors.accent} accessibilityLabel="Opening Zuno" />
        <Copy>Getting your Zuno ready…</Copy>
      </Frame>
    );
  if (route === 'welcome') return <Welcome />;
  if (route === 'retry')
    return (
      <Frame>
        <Copy title>Let’s reconnect</Copy>
        <Copy>{a.error || 'Your session is saved. Reconnect to load your profile.'}</Copy>
        <Action onPress={() => void a.reloadProfile()}>Retry</Action>
        <Action quiet onPress={() => void a.signOut()}>
          Sign out
        </Action>
      </Frame>
    );
  if (route !== 'map') return <Setup key={a.session!.user.id} profile={a.onboarding!} />;
  return children;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 18, paddingVertical: 30 },
  logo: { fontFamily: tokens.font.heavy, fontSize: 38, color: colors.ink, marginBottom: 12 },
  title: { fontFamily: tokens.font.display, fontSize: 30, lineHeight: 36, color: colors.ink },
  copy: { fontFamily: tokens.font.body, fontSize: 15, lineHeight: 22, color: colors.muted },
  label: { fontFamily: tokens.font.bold, fontSize: 15, color: colors.ink },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 18,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  quiet: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  buttonText: { fontFamily: tokens.font.bold, fontSize: 16, color: '#fff' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: tokens.font.body,
    color: colors.ink,
  },
  choice: { borderWidth: 2, borderColor: colors.line, borderRadius: 18, padding: 16, gap: 6 },
  error: { fontFamily: tokens.font.body, color: '#AC3925', lineHeight: 21 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  link: { fontFamily: tokens.font.medium, color: colors.muted, textDecorationLine: 'underline' },
});
