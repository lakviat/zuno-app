import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Button, EmptyState, Icon, Txt, ui } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useApp } from '../../state/AppContext';
import type { Navigate } from '../../navigation/routes';
import { uid } from '../../utils/time';
import {
  blockedBetween,
  canManageMeetup,
  getAuthorizedMeetup,
  meetupStatus,
  participationAction,
} from './domain';
import { audienceLabels } from './places';
import { localZone, meetupTime } from './localTime';

export function MeetupDetail({ meetupId, navigate }: { meetupId: string; navigate: Navigate }) {
  const { state, now, colors, meetupViewerId, runMeetup, notify, dispatch } = useApp();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState('');
  const m = getAuthorizedMeetup(state, meetupViewerId, meetupId);
  const back = () => navigate({ name: 'meetups' });
  const action = m && participationAction(state, meetupViewerId, m, now);
  const host = m && state.people.find((p) => p.user.id === m.hostId);
  const perform = (operation: 'join' | 'leave' | 'cancel') => {
    const result = runMeetup({ operation, id: meetupId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError('');
    setConfirmCancel(false);
    notify(
      operation === 'join'
        ? 'You’re in. Saved in this demo.'
        : operation === 'leave'
          ? 'You’ve left this meetup.'
          : 'Meetup cancelled. It stays in Joined.',
    );
  };
  return (
    <Sheet
      title="A little get-together"
      subtitle="Good company starts here."
      back={back}
      onClose={() => navigate({ name: 'map' })}
      footer={
        m && action ? (
          <View style={{ gap: 10 }}>
            {!!error && (
              <Txt accessibilityRole="alert" style={{ color: colors.accent }}>
                {error}
              </Txt>
            )}
            <Button
              disabled={!action.operation}
              icon={m.participantIds.includes(meetupViewerId) ? 'check' : 'plus'}
              onPress={() => {
                if (action.operation) perform(action.operation);
              }}
            >
              {action.label}
            </Button>
          </View>
        ) : undefined
      }
    >
      {!m ? (
        <EmptyState
          icon="lock"
          title="Meetup unavailable"
          body="It may be private, or no longer available to this viewer."
        />
      ) : (
        <>
          <View style={{ alignItems: 'center', paddingVertical: 10, gap: 12 }}>
            <Txt style={{ fontSize: 54 }}>{m.emoji}</Txt>
            <Txt weight="display" style={{ fontSize: 29, textAlign: 'center' }}>
              {m.title}
            </Txt>
            <Txt style={{ color: colors.accent }}>
              {audienceLabels[m.visibility]} · {meetupStatus(m, now)}
            </Txt>
            {!!m.description && (
              <Txt muted style={{ textAlign: 'center', lineHeight: 22 }}>
                {m.description}
              </Txt>
            )}
          </View>
          {host && (
            <View style={[ui.row, { gap: 12 }]}>
              <Avatar person={host} size={40} />
              <View>
                <Txt weight="bold">Hosted by {host.profile.displayName}</Txt>
                <Txt muted style={{ fontSize: 11 }}>
                  {m.hostId === meetupViewerId ? 'You’re hosting' : 'Meetup host'}
                </Txt>
              </View>
            </View>
          )}
          <View style={{ padding: 18, backgroundColor: colors.raised, borderRadius: 20, gap: 16 }}>
            <View style={[ui.row, { gap: 12 }]}>
              <Icon name="clock" />
              <View style={{ flex: 1 }}>
                <Txt>{meetupTime(m.startsAt)}</Txt>
                <Txt muted style={{ fontSize: 12, marginTop: 5 }}>
                  Until {meetupTime(m.endsAt)} · {localZone()}
                </Txt>
              </View>
            </View>
            <View style={[ui.row, { gap: 12 }]}>
              <Icon name="map-pin" />
              <View style={{ flex: 1 }}>
                <Txt weight="bold">{m.place.name}</Txt>
                <Txt muted style={{ fontSize: 12, marginTop: 5 }}>
                  {m.place.area} ·{' '}
                  {m.place.kind === 'area' ? 'Approximate area' : 'Public meeting place'}
                </Txt>
              </View>
            </View>
            <Txt muted style={{ fontSize: 11 }}>
              This is a meeting spot, never a participant’s live location.
            </Txt>
          </View>
          <View style={ui.between}>
            <Txt weight="bold">{m.participantIds.length} going</Txt>
            <Txt muted style={{ fontSize: 12 }}>
              {m.capacity
                ? `${Math.max(0, m.capacity - m.participantIds.length)} places left · ${m.capacity} total`
                : 'Room for everyone'}
            </Txt>
          </View>
          {m.participantIds
            .filter((id) => !blockedBetween(state, meetupViewerId, id))
            .map((id) => {
              const person = state.people.find((p) => p.user.id === id);
              return (
                person && (
                  <View key={id} style={[ui.row, { gap: 12 }]}>
                    <Avatar person={person} size={36} />
                    <Txt style={{ flex: 1 }}>{person.profile.displayName}</Txt>
                    <Txt muted style={{ fontSize: 11 }}>
                      {id === m.hostId ? 'Host' : id === meetupViewerId ? 'You’re in' : 'Going'}
                    </Txt>
                  </View>
                )
              );
            })}
          {canManageMeetup(m, meetupViewerId, now) && (
            <View style={{ gap: 10 }}>
              <Button
                kind="secondary"
                icon="edit-2"
                onPress={() => navigate({ name: 'edit-meetup', meetupId: m.id })}
              >
                Edit meetup
              </Button>
              {confirmCancel ? (
                <View style={{ gap: 10 }}>
                  <Txt>Cancel for everyone? This meetup will leave active discovery.</Txt>
                  <Button kind="danger" onPress={() => perform('cancel')}>
                    Confirm cancellation
                  </Button>
                  <Button kind="quiet" onPress={() => setConfirmCancel(false)}>
                    Keep meetup
                  </Button>
                </View>
              ) : (
                <Button kind="danger" onPress={() => setConfirmCancel(true)}>
                  Cancel meetup
                </Button>
              )}
            </View>
          )}
          {m.hostId !== meetupViewerId && (
            <Button
              kind="quiet"
              icon="flag"
              onPress={() => {
                dispatch({
                  type: 'report',
                  reporterId: meetupViewerId,
                  subjectId: m.id,
                  reason: 'Meetup concern (demo)',
                  id: uid(),
                  now: new Date().toISOString(),
                });
                notify('Report saved locally only. No moderation service is connected.');
              }}
            >
              Report meetup · local only
            </Button>
          )}
          <Txt muted style={{ fontSize: 11, lineHeight: 17 }}>
            Joining doesn’t add friends, open messaging, or share your location. Invitations and
            attendance stay on this device.
          </Txt>
        </>
      )}
    </Sheet>
  );
}
