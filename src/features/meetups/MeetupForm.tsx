import { useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { Button, Chip, EmptyState, Field, Icon, Txt, ui } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useApp } from '../../state/AppContext';
import type { Navigate, Route } from '../../navigation/routes';
import type { MeetupDraft, MeetupVisibility } from '../../types/domain';
import { uid } from '../../utils/time';
import { areFriends, blockedBetween, canManageMeetup, getAuthorizedMeetup } from './domain';
import { activities, audienceLabels, meetupPlaces } from './places';
import { endAfterStartChange, localDateTime, localZone, toInstant } from './localTime';
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
  const { state, now, meetupViewerId, meetupAreaId, setMeetupAreaId, runMeetup, colors, notify } =
    useApp();
  const existing = meetupId ? getAuthorizedMeetup(state, meetupViewerId, meetupId) : undefined;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '☕');
  const [placeId, setPlaceId] = useState(
    existing?.place.id ??
      meetupPlaces.find((p) => p.areaId === meetupAreaId)?.id ??
      meetupPlaces[0].id,
  );
  const [defaultStart] = useState(() => Math.ceil((Date.now() + 3600000) / 900000) * 900000);
  const [start, setStart] = useState(() => localDateTime(existing?.startsAt ?? defaultStart));
  const [end, setEnd] = useState(() => localDateTime(existing?.endsAt ?? defaultStart + 3600000));
  const [visibility, setVisibility] = useState<MeetupVisibility>(existing?.visibility ?? 'friends');
  const [invites, setInvites] = useState(existing?.invitedUserIds ?? (friendId ? [friendId] : []));
  const [capacity, setCapacity] = useState(existing?.capacity?.toString() ?? '');
  const [validation, setValidation] = useState<{ message: string; values: string }>();
  const [id] = useState(() => meetupId ?? uid());
  const [leaveTo, setLeaveTo] = useState<Route | null>(null);
  const formValues = JSON.stringify({
    title,
    description,
    emoji,
    placeId,
    start,
    end,
    visibility,
    invites,
    capacity,
  });
  const initialValues = useRef(formValues);
  const error = validation?.values === formValues ? validation.message : '';
  const requestLeave = (route: Route) => {
    Keyboard.dismiss();
    if (initialValues.current !== formValues) setLeaveTo(route);
    else navigate(route);
  };
  const changeStart = (next: string) => {
    setEnd(endAfterStartChange(start, end, next));
    setStart(next);
  };
  const friends = state.people.filter(
    (p) =>
      areFriends(state, meetupViewerId, p.user.id) &&
      !blockedBetween(state, meetupViewerId, p.user.id),
  );
  const allowed = !meetupId || (existing && canManageMeetup(existing, meetupViewerId, now));
  const save = () => {
    Keyboard.dismiss();
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
      setValidation({ message: result.error, values: formValues });
      return;
    }
    notify(meetupId ? 'Meetup updated.' : 'A little idea, a good get-together. Saved locally.');
    setMeetupAreaId(result.meetup.place.areaId);
    navigate({ name: 'meetups', meetupId: result.meetup.id });
  };
  return (
    <Sheet
      title={meetupId ? 'Edit meetup' : 'New meetup'}
      subtitle={`Hosted by ${state.people.find((p) => p.user.id === meetupViewerId)?.profile.displayName ?? 'you'}`}
      back={() => requestLeave({ name: 'meetups', meetupId })}
      onClose={() => requestLeave({ name: 'map' })}
      footer={
        allowed ? (
          <View style={{ gap: 10 }}>
            {leaveTo ? (
              <>
                <Txt weight="bold">Discard your unsaved changes?</Txt>
                <View style={[ui.row, { gap: 8 }]}>
                  <Button kind="secondary" style={{ flex: 1 }} onPress={() => setLeaveTo(null)}>
                    Keep editing
                  </Button>
                  <Button kind="danger" style={{ flex: 1 }} onPress={() => navigate(leaveTo)}>
                    Discard changes
                  </Button>
                </View>
              </>
            ) : (
              <>
                {!!error && (
                  <Txt accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12 }}>
                    {error}
                  </Txt>
                )}
                <Button icon="arrow-right" onPress={save}>
                  {meetupId ? 'Save changes' : 'Create meetup'}
                </Button>
              </>
            )}
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
            autoCapitalize="sentences"
          />
          <Field
            label="A little more (optional)"
            placeholder="I’ll grab us a table…"
            value={description}
            onChangeText={setDescription}
            maxLength={240}
            multiline
          />
          <View style={[ui.row, { gap: 8, flexWrap: 'wrap' }]}>
            <Chip
              label="In 30 min"
              icon="clock"
              onPress={() =>
                changeStart(localDateTime(Math.ceil((Date.now() + 1800000) / 300000) * 300000))
              }
            />
            <Chip
              label="In 1 hour"
              onPress={() =>
                changeStart(localDateTime(Math.ceil((Date.now() + 3600000) / 300000) * 300000))
              }
            />
          </View>
          <DateTimeField label="Starts" value={start} onChange={changeStart} />
          <DateTimeField label="Ends" value={end} onChange={setEnd} />
          <Txt muted style={{ fontSize: 11 }}>
            {localZone().replaceAll('_', ' ')} · Changing the start keeps your duration.
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
