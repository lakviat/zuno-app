import { Pressable, View } from 'react-native';
import { Icon, Txt, ui } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import type { Meetup } from '../../types/domain';
import { audienceLabels } from './places';
import { meetupStatus } from './domain';
import { meetupTime } from './localTime';
export function MeetupCard({ meetup: m, onPress }: { meetup: Meetup; onPress(): void }) {
  const { colors, state, now, meetupViewerId } = useApp();
  const status = meetupStatus(m, now);
  const host = state.people.find((p) => p.user.id === m.hostId)?.profile.displayName.split(' ')[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${m.title}`}
      onPress={onPress}
      style={{ padding: 20, backgroundColor: colors.raised, borderRadius: 23, gap: 12 }}
    >
      <View style={ui.between}>
        <Txt style={{ fontSize: 30 }}>{m.emoji}</Txt>
        <Txt style={{ color: colors.accent, fontSize: 11 }}>
          {status === 'Open' ? audienceLabels[m.visibility] : status}
        </Txt>
      </View>
      <Txt weight="display" style={{ fontSize: 25 }}>
        {m.title}
      </Txt>
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
        <Txt weight="medium" style={{ fontSize: 12 }}>
          {m.participantIds.length}
          {m.capacity ? ` / ${m.capacity}` : ''} going
          {m.participantIds.includes(meetupViewerId) ? ' · You’re in' : ''}
        </Txt>
        <Icon name="arrow-up-right" size={19} />
      </View>
    </Pressable>
  );
}
