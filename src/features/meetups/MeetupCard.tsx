import { Pressable, View } from 'react-native';
import { Avatar, Icon, Txt, ui } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import type { Meetup } from '../../types/domain';
import { audienceLabels } from './places';
import { blockedBetween, meetupStatus } from './domain';
import { meetupTime } from './localTime';
export function MeetupCard({ meetup: m, onPress }: { meetup: Meetup; onPress(): void }) {
  const { colors, state, now, meetupViewerId } = useApp();
  const status = meetupStatus(m, now);
  const host = state.people.find((p) => p.user.id === m.hostId)?.profile.displayName.split(' ')[0];
  const participants = m.participantIds
    .filter((id) => !blockedBetween(state, meetupViewerId, id))
    .flatMap((id) => {
      const person = state.people.find((p) => p.user.id === id);
      return person ? [person] : [];
    })
    .slice(0, 3);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${m.title}`}
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 18,
        backgroundColor: colors.raised,
        borderRadius: 22,
        gap: 12,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={[ui.row, { gap: 12, alignItems: 'flex-start' }]}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt style={{ fontSize: 25 }}>{m.emoji}</Txt>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt style={{ color: colors.accent, fontSize: 11 }}>
            {status === 'Open' ? audienceLabels[m.visibility] : status}
          </Txt>
          <Txt weight="display" style={{ fontSize: 22 }}>
            {m.title}
          </Txt>
        </View>
      </View>
      <Txt muted style={{ fontSize: 12 }}>
        {meetupTime(m.startsAt)} · {host} hosts
      </Txt>
      <View style={[ui.row, { gap: 7 }]}>
        <Icon name="map-pin" size={13} />
        <Txt muted style={{ fontSize: 12, flex: 1 }}>
          {m.place.name}
        </Txt>
      </View>
      <View style={ui.between}>
        <View style={[ui.row, { gap: 10, flex: 1 }]}>
          <View style={ui.row}>
            {participants.map((p, index) => (
              <View
                key={p.user.id}
                style={{
                  marginLeft: index ? -8 : 0,
                  borderWidth: 2,
                  borderColor: colors.raised,
                  borderRadius: 20,
                }}
              >
                <Avatar person={p} size={24} />
              </View>
            ))}
          </View>
          <Txt weight="medium" style={{ fontSize: 12, flex: 1 }}>
            {m.participantIds.length}
            {m.capacity ? ` / ${m.capacity}` : ''} going
            {m.participantIds.includes(meetupViewerId) ? ' · You’re in' : ''}
          </Txt>
        </View>
        <Icon name="arrow-up-right" size={19} />
      </View>
    </Pressable>
  );
}
