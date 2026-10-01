import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Chip, EmptyState, Field, Icon, Txt, ui } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useApp } from '../../state/AppContext';
import type { Navigate } from '../../navigation/routes';
import type { MeetupDraft, MeetupVisibility } from '../../types/domain';
import { uid } from '../../utils/time';
import { areFriends, blockedBetween, canManageMeetup, getAuthorizedMeetup } from './domain';
import { activities, audienceLabels, meetupPlaces } from './places';
import { localDateTime, localZone, toInstant } from './localTime';
import { DateTimeField } from './DateTimeField';

export function MeetupForm({
  friendId,
  meetupId,
  navigate,
}: {
  friendId?: string;
  meetupId?: string;
  navigate: Navigate;
}) {
  const { state, now, meetupViewerId, runMeetup, colors, notify } = useApp();
  const existing = meetupId ? getAuthorizedMeetup(state, meetupViewerId, meetupId) : undefined;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '☕');
  const [placeId, setPlaceId] = useState(existing?.place.id ?? meetupPlaces[0].id);
  const [start, setStart] = useState(() =>
    localDateTime(existing?.startsAt ?? Date.now() + 3600000),
  );
  const [end, setEnd] = useState(() => localDateTime(existing?.endsAt ?? Date.now() + 7200000));
  const [visibility, setVisibility] = useState<MeetupVisibility>(existing?.visibility ?? 'friends');
  const [invites, setInvites] = useState(existing?.invitedUserIds ?? (friendId ? [friendId] : []));
  const [capacity, setCapacity] = useState(existing?.capacity?.toString() ?? '');
  const [error, setError] = useState('');
  const [id] = useState(() => meetupId ?? uid());
  const friends = state.people.filter(
    (p) =>
      areFriends(state, meetupViewerId, p.user.id) &&
      !blockedBetween(state, meetupViewerId, p.user.id),
  );
  const allowed = !meetupId || (existing && canManageMeetup(existing, meetupViewerId, now));
  const save = () => {
    const draft: MeetupDraft = {
      title,
      description,
      emoji,
      placeId,
      startsAt: toInstant(start),
      endsAt: toInstant(end),
      visibility,
      invitedUserIds: invites,
      capacity: capacity.trim()
        ? /^\d+$/.test(capacity.trim())
          ? Number(capacity)
          : NaN
        : undefined,
    };
    const result = runMeetup({ operation: meetupId ? 'edit' : 'create', id, draft });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    notify(meetupId ? 'Meetup updated.' : 'A little idea, a good get-together. Saved locally.');
    navigate({ name: 'meetups', meetupId: result.meetup.id });
  };
  return (
    <Sheet
      title={meetupId ? 'Edit meetup' : 'Make a little meetup'}
      subtitle={`Hosted by ${state.people.find((p) => p.user.id === meetupViewerId)?.profile.displayName ?? 'you'}`}
      back={() => navigate({ name: 'meetups', meetupId })}
      onClose={() => navigate({ name: 'map' })}
      footer={
        allowed ? (
          <View style={{ gap: 10 }}>
            {!!error && (
              <Txt accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12 }}>
                {error}
              </Txt>
            )}
            <Button icon="arrow-right" onPress={save}>
              {meetupId ? 'Save changes' : 'Create meetup'}
            </Button>
          </View>
        ) : undefined
      }
    >
      {!allowed ? (
        <EmptyState
          icon="lock"
          title="Editing unavailable"
          body="Only the host can change an upcoming meetup."
        />
      ) : (
        <>
          <View style={[ui.row, { gap: 8 }]}>
            {activities.map((a) => (
              <Pressable
                key={a.emoji}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${a.label}`}
                accessibilityState={{ selected: a.emoji === emoji }}
                onPress={() => setEmoji(a.emoji)}
                style={{
                  flex: 1,
                  height: 50,
                  borderRadius: 16,
                  backgroundColor: emoji === a.emoji ? colors.accentSoft : colors.raised,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt style={{ fontSize: 25 }}>{a.emoji}</Txt>
              </Pressable>
            ))}
          </View>
          <Field
            label="Meetup title"
            placeholder="Coffee & a catch-up"
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />
          <Field
            label="A little more (optional)"
            placeholder="I’ll grab us a table…"
            value={description}
            onChangeText={setDescription}
            maxLength={240}
            multiline
          />
          <DateTimeField label="Starts" value={start} onChange={setStart} />
          <DateTimeField label="Ends" value={end} onChange={setEnd} />
          <Txt muted style={{ fontSize: 11 }}>
            Times are in {localZone()}. Invites won’t join anyone automatically.
          </Txt>
          <Txt weight="bold">Who can see and join?</Txt>
          <View style={[ui.row, { flexWrap: 'wrap', gap: 7 }]}>
            {(['friends', 'invite-only', 'public'] as const).map((v) => (
              <Chip
                key={v}
                label={audienceLabels[v]}
                active={v === visibility}
                onPress={() => setVisibility(v)}
              />
            ))}
          </View>
          <Txt muted style={{ fontSize: 12, lineHeight: 18 }}>
            {visibility === 'public'
              ? 'Anyone browsing this demo area can see and join. Only your chosen meeting spot is published.'
              : visibility === 'friends'
                ? 'Your accepted friends can discover and join.'
                : 'Only you and the friends you invite can see or join.'}
          </Txt>
          <Txt weight="bold">Pick a meeting spot</Txt>
          {meetupPlaces.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Meet at ${p.name}`}
              accessibilityState={{ selected: placeId === p.id }}
              onPress={() => setPlaceId(p.id)}
              style={[
                ui.row,
                {
                  padding: 15,
                  gap: 12,
                  borderRadius: 15,
                  backgroundColor: colors.raised,
                  borderWidth: 1,
                  borderColor: p.id === placeId ? colors.accent : colors.line,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Txt weight="medium">{p.name}</Txt>
                <Txt muted style={{ fontSize: 11, marginTop: 4 }}>
                  {p.area} · {p.kind === 'area' ? 'Approximate area' : 'Public venue'}
                </Txt>
              </View>
              <Icon
                name={p.id === placeId ? 'check-circle' : 'circle'}
                color={p.id === placeId ? colors.accent : colors.muted}
                size={19}
              />
            </Pressable>
          ))}
          <Field
            label="Capacity including you (optional)"
            placeholder="No limit"
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="number-pad"
            maxLength={7}
          />
          <Txt weight="bold">Invite friends · {invites.length} selected</Txt>
          <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
            {friends.map((p) => (
              <Chip
                key={p.user.id}
                label={`Invite ${p.profile.displayName.split(' ')[0]}`}
                active={invites.includes(p.user.id)}
                onPress={() =>
                  setInvites((prev) =>
                    prev.includes(p.user.id)
                      ? prev.filter((id) => id !== p.user.id)
                      : [...prev, p.user.id],
                  )
                }
              />
            ))}
          </View>
          {friends.length === 0 && (
            <Txt muted>This demo viewer has no accepted friends to invite yet.</Txt>
          )}
        </>
      )}
    </Sheet>
  );
}
