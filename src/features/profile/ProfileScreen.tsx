import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Button, Chip, Field, Icon, Txt, ui } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useApp } from '../../state/AppContext';
import { isBlocked, isFriend } from '../../utils/privacy';
import { uid } from '../../utils/time';
import type { Navigate } from '../../navigation/routes';

export function ProfileScreen({ userId, navigate }: { userId?: string; navigate: Navigate }) {
  const { now, state, me, friends, colors, dispatch, reset, notify } = useApp();
  const person = state.people.find((p) => p.user.id === userId) ?? me;
  const own = person.user.id === state.currentUserId;
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(person.profile.displayName);
  const [bio, setBio] = useState(person.profile.bio);
  const [status, setStatus] = useState(person.presence.status);
  const [confirm, setConfirm] = useState<'remove' | 'block' | 'reset' | 'report' | null>(null);
  const [reason, setReason] = useState('');
  const friend = isFriend(state, person.user.id);
  const blocked = isBlocked(state, person.user.id);
  const pending = state.friendships.some(
    (f) => f.status === 'pending' && [f.addresseeId, f.requesterId].includes(person.user.id),
  );
  const save = () => {
    if (!name.trim()) return;
    dispatch({ type: 'profile', value: { displayName: name.trim(), bio: bio.trim() }, status });
    setEdit(false);
    notify('Your profile feels a little more you.');
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
      dispatch({
        type: 'report',
        subjectId: person.user.id,
        reason: reason.trim(),
        id: uid(),
        now: new Date().toISOString(),
      });
      notify('Report saved locally. This demo has no moderation delivery service.');
    } else if (confirm) {
      dispatch({
        type: 'friend',
        id: person.user.id,
        operation: confirm,
        now: new Date().toISOString(),
      });
      notify(
        confirm === 'block' ? 'Blocked and removed from your world.' : 'Removed from your friends.',
      );
      navigate({ name: 'friends' });
    }
    setConfirm(null);
  };
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
            {person.presence.emoji} {person.presence.status}
          </Txt>
        </View>
        <Txt muted style={{ lineHeight: 22, textAlign: 'center', marginTop: 6 }}>
          {person.profile.bio}
        </Txt>
        <View style={[ui.row, { gap: 5 }]}>
          <Icon name="map-pin" color={colors.muted} size={13} />
          <Txt muted style={{ fontSize: 12 }}>
            {person.profile.city} · profile city
          </Txt>
        </View>
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
                  state.plans.filter(
                    (p) =>
                      p.participants.some((x) => x.userId === me.user.id) &&
                      Date.parse(p.expiresAt) > now,
                  ).length
                }
              </Txt>
              <Txt muted style={{ fontSize: 11 }}>
                little plans
              </Txt>
            </View>
          </View>
          {edit ? (
            <>
              <Field label="Display name" value={name} onChangeText={setName} maxLength={40} />
              <Field label="Your bio" value={bio} onChangeText={setBio} maxLength={160} multiline />
              <Field
                label="Current status"
                value={status}
                onChangeText={setStatus}
                maxLength={80}
              />
              <Button onPress={save} disabled={!name.trim()}>
                Save your changes
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
          <Button kind="danger" onPress={() => setConfirm('reset')}>
            Delete local demo data
          </Button>
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
                onPress={() => navigate({ name: 'create-plan', friendId: person.user.id })}
              >
                Make a plan together
              </Button>
              <Button kind="quiet" onPress={() => setConfirm('remove')}>
                Remove friend
              </Button>
            </>
          ) : (
            <Button
              disabled={pending || blocked}
              onPress={() =>
                dispatch({
                  type: 'friend',
                  id: person.user.id,
                  operation: 'add',
                  now: new Date().toISOString(),
                })
              }
            >
              {blocked ? 'Blocked' : pending ? 'Friend request pending' : 'Add to your people'}
            </Button>
          )}
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
              ? 'Messages, plans, profile edits and settings will be erased. A fresh sample world will replace them. No online account exists yet.'
              : confirm === 'report'
                ? 'Reports are stored locally in this prototype and aren’t sent to a moderation team.'
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
            {confirm === 'report' ? 'Save local report' : 'Confirm'}
          </Button>
          <Button kind="quiet" onPress={() => setConfirm(null)}>
            Cancel
          </Button>
        </View>
      )}
    </Sheet>
  );
}
