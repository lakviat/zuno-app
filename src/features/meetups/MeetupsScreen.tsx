import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, EmptyState, Txt, ui } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useApp } from '../../state/AppContext';
import type { Navigate } from '../../navigation/routes';
import { listVisibleMeetups, type MeetupFilter } from './domain';
import { demoAreas } from './places';
import { MeetupCard } from './MeetupCard';
import { MeetupDetail } from './MeetupDetail';
export function MeetupsScreen({
  meetupId,
  clusterIds,
  navigate,
}: {
  meetupId?: string;
  clusterIds?: string[];
  navigate: Navigate;
}) {
  const { state, now, colors, meetupViewerId, setMeetupViewerId, meetupAreaId, setMeetupAreaId } =
    useApp();
  const [filter, setFilter] = useState<MeetupFilter>('all');
  if (meetupId) return <MeetupDetail meetupId={meetupId} navigate={navigate} />;
  const visible = listVisibleMeetups(state, meetupViewerId, { now, filter, areaId: meetupAreaId });
  const meetups = clusterIds ? visible.filter((m) => clusterIds.includes(m.id)) : visible;
  return (
    <Sheet
      title="Meetups"
      subtitle="A little get-together goes a long way."
      onClose={() => navigate({ name: 'map' })}
      footer={
        <Button icon="plus" onPress={() => navigate({ name: 'create-meetup' })}>
          Create a meetup
        </Button>
      }
    >
      <View style={{ backgroundColor: colors.accentSoft, padding: 15, borderRadius: 18, gap: 10 }}>
        <Txt weight="bold" style={{ fontSize: 12 }}>
          Try another point of view · local demo
        </Txt>
        <View style={[ui.row, { gap: 8, flexWrap: 'wrap' }]}>
          {['me', 'noah'].map((id) => (
            <Chip
              key={id}
              label={`View as ${state.people.find((p) => p.user.id === id)?.profile.displayName.split(' ')[0] ?? id}`}
              active={meetupViewerId === id}
              onPress={() => setMeetupViewerId(id)}
            />
          ))}
        </View>
        <Txt muted style={{ fontSize: 11, lineHeight: 16 }}>
          This changes only the meetup viewer. Noah starts as a non-friend. Personal map pins are
          hidden in his preview.
        </Txt>
      </View>
      {clusterIds && (
        <Button kind="secondary" onPress={() => navigate({ name: 'meetups' })}>
          Show all meetups
        </Button>
      )}
      <Txt weight="bold" style={{ fontSize: 12 }}>
        Browse an area
      </Txt>
      <View style={[ui.row, { gap: 8, flexWrap: 'wrap' }]}>
        {demoAreas.map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            active={a.id === meetupAreaId}
            onPress={() => setMeetupAreaId(a.id)}
          />
        ))}
      </View>
      <View style={[ui.row, { flexWrap: 'wrap', gap: 7 }]}>
        {(
          [
            ['all', 'All meetups'],
            ['friends', 'Friends'],
            ['public', 'Public nearby'],
            ['today', 'Today'],
            ['joined', 'Joined'],
          ] as const
        ).map(([id, label]) => (
          <Chip key={id} label={label} active={filter === id} onPress={() => setFilter(id)} />
        ))}
      </View>
      {meetups.length === 0 ? (
        <EmptyState
          icon="sun"
          title="An open afternoon"
          body={
            filter === 'joined'
              ? 'Meetups you join appear here, including ended and cancelled ones.'
              : 'Nothing here yet. Pick another area or get a few people together.'
          }
        />
      ) : (
        meetups.map((m) => (
          <MeetupCard
            key={m.id}
            meetup={m}
            onPress={() => navigate({ name: 'meetups', meetupId: m.id })}
          />
        ))
      )}
      <Txt muted style={{ fontSize: 11 }}>
        Public nearby shows meetups published in this area. Browsing never requires your device
        location.
      </Txt>
    </Sheet>
  );
}
