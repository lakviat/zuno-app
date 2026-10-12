import { presenceText } from '../presence/presentation';
import { AvatarUpload } from './AvatarUpload';
import { useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { Avatar, Button, Chip, Field, Icon, Txt, ui } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useApp } from '../../state/AppContext';
import { isBlocked, isFriend } from '../../utils/privacy';
import { uid } from '../../utils/time';
import type { Navigate } from '../../navigation/routes';
import { FriendshipActions } from '../friends/FriendshipActions';
import { useMotion } from '../location/store';
import { instagramHandle, instagramUrl, profileDistance } from './details';

export function ProfileScreen({ userId, navigate }: { userId?: string; navigate: Navigate }) {
  const { now, state, me, friends, colors, dispatch, reset, notify, cloud } = useApp();
  const person = state.people.find((p) => p.user.id === userId) ?? me;
  const own = person.user.id === state.currentUserId;
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(person.profile.displayName);
  const [username, setUsername] = useState(person.profile.username);
  const [bio, setBio] = useState(person.profile.bio);
  const [instagram, setInstagram] = useState(person.profile.instagram ?? '');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [manageFriend, setManageFriend] = useState(false);
  const device = useMotion(state.currentUserId);
  const distance = profileDistance(state, person.user.id, now, device);
  const socialUrl = instagramUrl(person.profile.instagram ?? '');
  const [status, setStatus] = useState(person.presence.status);
  const [confirm, setConfirm] = useState<'remove' | 'block' | 'reset' | 'report' | null>(null);
  const [reason, setReason] = useState('');
  const friend = isFriend(state, person.user.id);
  const blocked = isBlocked(state, person.user.id);
  const save = async () => {
    if (!name.trim() || saveInFlight.current) return;
    const handle = instagramHandle(instagram);
    if (handle === undefined) {
      setSaveError(
        'Use an Instagram username of up to 30 letters, numbers, periods or underscores.',
      );
      return;
    }
    setSaveError('');
    saveInFlight.current = true;
    setSaving(true);
    try {
      if (
        !(await dispatch({
          type: 'profile',
          value: {
            displayName: name.trim(),
            bio: bio.trim(),
            instagram: handle,
            ...(cloud ? { username: username.toLowerCase().trim() } : {}),
          },
          status,
        }))
      ) {
        setSaveError('Your profile wasn’t saved. Please try again.');
        return;
      }
      setInstagram(handle);
      setEdit(false);
      notify('Your profile feels a little more you.');
    } catch {
      setSaveError('Your profile wasn’t saved. Please try again.');
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };
  const perform = async () => {
    if (confirm === 'reset') {
      try {
        await reset();
        navigate({ name: 'map' });
      } catch {
        notify('Could not reset local storage. Please try again.');
      }
    } else if (confirm === 'report') {
      const saved = await dispatch({
        type: 'report',
        subjectId: person.user.id,
        reason: reason.trim(),
        id: uid(),
        now: new Date().toISOString(),
      });
      if (!saved) return;
      notify(
        cloud
          ? 'Report saved for review.'
          : 'Report saved locally. This demo has no moderation delivery service.',
      );
    } else if (confirm) {
      const saved = await dispatch({
        type: 'friend',
        id: person.user.id,
        operation: confirm,
        now: new Date().toISOString(),
      });
      if (!saved) return;
      notify(
        confirm === 'block' ? 'Blocked and removed from your world.' : 'Removed from your friends.',
      );
      navigate({ name: 'friends' });
    }
    setConfirm(null);
  };
  if (userId && userId !== state.currentUserId && !state.people.some((p) => p.user.id === userId)) {
    return (
      <Sheet title="Profile unavailable" onClose={() => navigate({ name: 'map' })}>
        <Txt muted>
          This profile is no longer available. Return to your map to refresh your world.
        </Txt>
      </Sheet>
    );
  }
  return (
    <Sheet
      title={own ? 'A little about you' : person.profile.displayName.split(' ')[0]}
      subtitle={own ? 'Your corner of this little world.' : `@${person.profile.username}`}
      onClose={() => navigate({ name: 'map' })}
    >
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
        <View
          style={{ padding: 6, borderWidth: 2, borderColor: colors.accentSoft, borderRadius: 70 }}
        >
          <Avatar person={person} size={96} online={person.presence.freeNow} />
        </View>
        <Txt weight="display" style={{ fontSize: 29 }}>
          {person.profile.displayName}
        </Txt>
        <Txt muted>@{person.profile.username}</Txt>
        <View
          style={{
            paddingHorizontal: 13,
            paddingVertical: 9,
            borderRadius: 20,
            backgroundColor: colors.greenSoft,
          }}
        >
          <Txt style={{ color: colors.green, fontSize: 12 }}>
            {presenceText(person.presence, now)}
          </Txt>
        </View>
        {!!socialUrl && (
          <Button
            kind="secondary"
            icon="instagram"
            onPress={() => {
              void Linking.openURL(socialUrl).catch(() =>
                notify('Could not open Instagram. Please try again.'),
              );
            }}
          >{`@${person.profile.instagram}`}</Button>
        )}
        {!!person.profile.city && (
          <View style={[ui.row, { gap: 5 }]}>
            <Icon name="map-pin" color={colors.muted} size={13} />
            <Txt muted style={{ fontSize: 12 }}>
              {person.profile.city}
            </Txt>
          </View>
        )}
      </View>
      {!own && (
        <FriendshipActions
          key={person.user.id}
          userId={person.user.id}
          onManage={() => setManageFriend((open) => !open)}
        />
      )}
      {friend && manageFriend && (
        <View style={{ padding: 16, backgroundColor: colors.raised, borderRadius: 16, gap: 8 }}>
          <Txt muted>You’re already friends.</Txt>
          <Button kind="quiet" onPress={() => setConfirm('remove')}>
            Remove friend
          </Button>
        </View>
      )}
      <View style={{ padding: 20, borderRadius: 20, backgroundColor: colors.raised, gap: 12 }}>
        <Txt weight="bold" style={{ fontSize: 18 }}>
          About me
        </Txt>
        {!own && (
          <View style={[ui.row, { gap: 7 }]}>
            <Icon name="navigation" size={14} color={colors.muted} />
            <Txt muted style={{ fontSize: 12 }}>
              {distance ?? 'Distance unavailable'}
            </Txt>
          </View>
        )}
        <Txt muted style={{ lineHeight: 22 }}>
          {person.profile.bio ||
            (own ? 'Add a short bio so people can get to know you.' : 'No bio yet.')}
        </Txt>
      </View>
      {own ? (
        <>
          <View
            style={[
              ui.row,
              {
                justifyContent: 'center',
                gap: 35,
                padding: 16,
                backgroundColor: colors.raised,
                borderRadius: 20,
              },
            ]}
          >
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Txt weight="display" style={{ fontSize: 26 }}>
                {friends.length}
              </Txt>
              <Txt muted style={{ fontSize: 11 }}>
                good people
              </Txt>
            </View>
            <View style={{ width: 1, height: 40, backgroundColor: colors.line }} />
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Txt weight="display" style={{ fontSize: 26 }}>
                {
                  state.meetups.filter(
                    (p) =>
                      p.participantIds.includes(me.user.id) &&
                      Date.parse(p.endsAt) > now &&
                      p.status !== 'cancelled',
                  ).length
                }
              </Txt>
              <Txt muted style={{ fontSize: 11 }}>
                little meetups
              </Txt>
            </View>
          </View>
          {edit ? (
            <>
              <Field label="Display name" value={name} onChangeText={setName} maxLength={40} />
              {cloud && (
                <Field
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  maxLength={40}
                />
              )}
              <Field
                label="About me"
                placeholder="A little about you and what you enjoy…"
                value={bio}
                onChangeText={setBio}
                maxLength={160}
                multiline
                editable={!saving}
              />
              <Field
                label="Instagram (optional)"
                placeholder="@your_username"
                value={instagram}
                onChangeText={setInstagram}
                maxLength={100}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
              />
              <Field
                label="Current status"
                value={status}
                onChangeText={setStatus}
                maxLength={80}
              />
              {!!saveError && (
                <Txt accessibilityRole="alert" style={{ color: colors.accent }}>
                  {saveError}
                </Txt>
              )}
              <Button onPress={save} disabled={!name.trim() || saving}>
                {saving ? 'Saving…' : 'Save your changes'}
              </Button>
            </>
          ) : (
            <Button kind="secondary" icon="edit-2" onPress={() => setEdit(true)}>
              Edit profile & status
            </Button>
          )}
          <Button kind="secondary" icon="shield" onPress={() => navigate({ name: 'privacy' })}>
            Location & privacy
          </Button>
          <Button kind="secondary" icon="zap" onPress={() => navigate({ name: 'availability' })}>
            Availability & intent
          </Button>
          {cloud && <AvatarUpload />}
          <Txt weight="bold">Set the mood</Txt>
          <View style={[ui.row, { gap: 8 }]}>
            {(['light', 'dark', 'system'] as const).map((t) => (
              <Chip
                key={t}
                label={t.charAt(0).toUpperCase() + t.slice(1)}
                icon={t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'smartphone'}
                active={state.theme === t}
                onPress={() => dispatch({ type: 'theme', value: t })}
              />
            ))}
          </View>
          <Button kind="secondary" icon="user" onPress={() => navigate({ name: 'account' })}>
            Your Zuno account
          </Button>
          {!cloud && (
            <Button kind="danger" onPress={() => setConfirm('reset')}>
              Delete local demo data
            </Button>
          )}
        </>
      ) : (
        <>
          {friend && !blocked ? (
            <>
              <Button
                icon="message-circle"
                onPress={() => navigate({ name: 'inbox', friendId: person.user.id })}
              >
                Say hello
              </Button>
              <Button
                kind="secondary"
                icon="plus"
                onPress={() => navigate({ name: 'create-meetup', friendId: person.user.id })}
              >
                Make a meetup together
              </Button>
            </>
          ) : null}
          <View style={[ui.row, { gap: 8 }]}>
            <Button style={{ flex: 1 }} kind="danger" onPress={() => setConfirm('block')}>
              Block person
            </Button>
            <Button style={{ flex: 1 }} kind="quiet" onPress={() => setConfirm('report')}>
              Report
            </Button>
          </View>
        </>
      )}
      {confirm && (
        <View
          style={{
            padding: 20,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.accent,
            gap: 12,
          }}
        >
          <Txt weight="bold">
            {confirm === 'reset'
              ? 'Delete your local changes?'
              : confirm === 'report'
                ? 'Tell us what happened'
                : `${confirm === 'block' ? 'Block' : 'Remove'} ${person.profile.displayName.split(' ')[0]}?`}
          </Txt>
          <Txt muted style={{ fontSize: 12, lineHeight: 19 }}>
            {confirm === 'reset'
              ? 'Messages, meetups, profile edits and settings will be erased. A fresh sample world will replace them. Your online account, if any, is managed separately under Your Zuno account.'
              : confirm === 'report'
                ? cloud
                  ? 'Your report is saved privately for review. For emergencies, contact local services.'
                  : 'Reports are stored locally in this prototype and aren’t sent to a moderation team.'
                : 'They’ll disappear from your map. Any temporary location access will end.'}
          </Txt>
          {confirm === 'report' && (
            <Field
              label="Reason"
              placeholder="Describe the issue"
              value={reason}
              onChangeText={setReason}
              maxLength={500}
              multiline
            />
          )}
          <Button disabled={confirm === 'report' && !reason.trim()} onPress={() => void perform()}>
            {confirm === 'report' ? (cloud ? 'Submit report' : 'Save local report') : 'Confirm'}
          </Button>
          <Button kind="quiet" onPress={() => setConfirm(null)}>
            Cancel
          </Button>
        </View>
      )}
    </Sheet>
  );
}
