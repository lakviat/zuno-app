import { NotificationSettings } from './NotificationSettings';
import { useApp } from '../../state/AppContext';
import { useLiveLocation } from '../location/LiveLocation';
import { removeAccountPhotos } from '../../backend/media';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Button, Field, Txt } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import type { Navigate } from '../../navigation/routes';
import { AUTH_REDIRECT } from '../../backend/authCallback';
import { readCloudProfile } from '../../backend/profiles';
import { backendConfig, supabase, useAccount } from './AccountProvider';

export function AccountScreen({ navigate }: { navigate: Navigate }) {
  const { session } = useAccount();
  return <AccountContent key={session?.user.id ?? 'signed-out'} navigate={navigate} />;
}

function AccountContent({ navigate }: { navigate: Navigate }) {
  const { remote, dispatch, me } = useApp();
  const live = useLiveLocation();
  const { session, ready, error: sessionError, signOut: endAccount } = useAccount();
  const userId = session?.user.id;
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [reload, setReload] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(Date.now);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!resendAt) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  useEffect(() => {
    let alive = true;
    if (userId && supabase) {
      void readCloudProfile(supabase, userId)
        .then((profile) => {
          if (!alive) return;
          setName(profile?.display_name ?? '');
          setBio(profile?.bio ?? '');
          setProfileReady(true);
        })
        .catch(() => {
          if (alive)
            setError(
              'We could not load your account profile. Check your connection and try again.',
            );
        });
    }
    return () => {
      alive = false;
    };
  }, [userId, reload]);
  const perform = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await work();
    } catch (issue) {
      if (mounted.current)
        setError(
          issue instanceof Error
            ? issue.message
            : 'This request could not be completed. Please try again.',
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const requestLink = () =>
    void perform(async () => {
      if (!supabase) return;
      const address = email.trim().toLowerCase();
      const { error: issue } = await supabase.auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: true, emailRedirectTo: AUTH_REDIRECT },
      });
      if (issue)
        throw new Error(
          'We could not send a sign-in link. Check your email address, wait a minute and try again.',
        );
      if (!mounted.current) return;
      setSentTo(address);
      setResendAt(Date.now() + 60000);
      setClock(Date.now());
      setMessage('Open the sign-in link in your email on this same iPhone.');
    });
  const save = () =>
    void perform(async () => {
      if (!supabase || !session) return;
      const saved = await dispatch({
        type: 'profile',
        value: { displayName: name.trim(), bio: bio.trim() },
        status: me.presence.status,
      });
      if (!saved)
        throw new Error('Your profile was not saved. Check your connection and try again.');
      if (mounted.current) setMessage('Your account profile is saved online.');
    });
  const signOut = () => void perform(endAccount);
  const deleteAccount = () =>
    void perform(async () => {
      if (!supabase) return;
      live.stop();
      await remote?.clear().catch(() => undefined);
      if (userId) await removeAccountPhotos(supabase, userId);
      if (!remote) return;
      await remote.call('zuno_delete_my_account');
      await endAccount();
      if (mounted.current) setMessage('Your online account and account profile have been deleted.');
    });
  const configured = backendConfig.status === 'configured';
  return (
    <Sheet
      title="Your Zuno account"
      subtitle="A place to start your real Zuno profile."
      onClose={() => navigate({ name: 'map' })}
      back={() => navigate({ name: 'profile' })}
    >
      <Txt muted style={{ lineHeight: 21 }}>
        Your account connects your profile, friends, meetups and conversations across devices. Your
        location stays private until you explicitly enable sharing.
      </Txt>
      {!configured ? (
        <Txt>
          Online accounts are not enabled in this build. You can keep exploring the sample map.
        </Txt>
      ) : !ready ? (
        <ActivityIndicator accessibilityLabel="Restoring account" />
      ) : session ? (
        <>
          <Txt weight="bold">Signed in as {session.user.email}</Txt>
          {!profileReady ? (
            <Button
              kind="secondary"
              disabled={busy}
              onPress={() => setReload((value) => value + 1)}
            >
              Retry loading account profile
            </Button>
          ) : (
            <>
              <Field
                label="Account display name"
                value={name}
                onChangeText={setName}
                maxLength={40}
                editable={!busy}
              />
              <Field
                label="Account bio"
                value={bio}
                onChangeText={setBio}
                maxLength={160}
                multiline
                editable={!busy}
              />
              <Button disabled={busy || !name.trim()} onPress={save}>
                {busy ? 'Saving…' : 'Save account profile'}
              </Button>
            </>
          )}
          <Button kind="quiet" onPress={() => navigate({ name: 'privacy' })}>
            Location sharing & privacy
          </Button>
          <NotificationSettings />
          <Button kind="secondary" onPress={() => setConfirmSignOut(true)} disabled={busy}>
            Sign out of this device
          </Button>
          {confirmSignOut && (
            <View style={{ gap: 12 }}>
              <Txt weight="bold">Sign out of Zuno?</Txt>
              <Txt muted>Your live location will stop sharing on this iPhone.</Txt>
              <Button disabled={busy} onPress={signOut}>
                Sign out
              </Button>
              <Button kind="quiet" disabled={busy} onPress={() => setConfirmSignOut(false)}>
                Cancel
              </Button>
            </View>
          )}
          <Button kind="danger" onPress={() => setConfirmDelete(true)} disabled={busy}>
            Delete online account
          </Button>
          {confirmDelete && (
            <View style={{ gap: 14 }}>
              <Txt weight="bold">Permanently delete your online account?</Txt>
              <Txt muted>
                Your account, profile, photos, location, friendships and hosted meetups will be
                deleted. Your messages and direct conversations will also be removed. This cannot be
                undone.
              </Txt>
              <Button kind="danger" disabled={busy} onPress={deleteAccount}>
                Permanently delete my account
              </Button>
              <Button kind="quiet" disabled={busy} onPress={() => setConfirmDelete(false)}>
                Keep my account
              </Button>
            </View>
          )}
        </>
      ) : (
        <>
          <Field
            label="Email address"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            editable={!busy && !sentTo}
            onChangeText={setEmail}
          />
          <Txt muted>
            We use your email to sign you in. Continuing creates an account if you do not already
            have one.
          </Txt>
          {Platform.OS === 'web' ? (
            <Txt>
              Open the iOS app to sign in. Email links return to the same iPhone that requested
              them.
            </Txt>
          ) : sentTo ? (
            <>
              <Txt>A sign-in link was sent to {sentTo}. Open it on this iPhone.</Txt>
              <Button kind="secondary" disabled={busy || clock < resendAt} onPress={requestLink}>
                Send another sign-in link
              </Button>
              <Button
                kind="quiet"
                disabled={busy}
                onPress={() => {
                  setSentTo('');
                  setMessage('');
                }}
              >
                Use another email
              </Button>
            </>
          ) : (
            <Button
              disabled={
                busy || clock < resendAt || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
              }
              onPress={requestLink}
            >
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
          )}
        </>
      )}
      {!!(error || sessionError) && <Txt accessibilityRole="alert">{error || sessionError}</Txt>}
      {!!message && <Txt accessibilityRole="alert">{message}</Txt>}
    </Sheet>
  );
}
