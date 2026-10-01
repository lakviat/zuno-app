import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Chip, EmptyState, Icon, Txt, ui } from '../../components/ui';
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const viewerName =
    state.people.find((p) => p.user.id === meetupViewerId)?.profile.displayName.split(' ')[0] ??
    'Maya';
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
      <View style={{ gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch demo viewer"
          accessibilityState={{ expanded: previewOpen }}
          onPress={() => setPreviewOpen(!previewOpen)}
          style={[
            ui.between,
            {
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: colors.raised,
            },
          ]}
        >
          <Txt muted style={{ fontSize: 12 }}>
            Viewing as{' '}
            <Txt weight="bold" style={{ fontSize: 12 }}>
              {viewerName}
            </Txt>{' '}
            · Local demo
          </Txt>
          <Icon name={previewOpen ? 'chevron-up' : 'repeat'} size={16} />
        </Pressable>
        {previewOpen && (
          <View
            style={{ padding: 12, backgroundColor: colors.accentSoft, borderRadius: 14, gap: 10 }}
          >
            <View style={[ui.row, { gap: 8, flexWrap: 'wrap' }]}>
              {['me', 'noah'].map((id) => (
                <Chip
                  key={id}
                  label={`View as ${state.people.find((p) => p.user.id === id)?.profile.displayName.split(' ')[0] ?? id}`}
                  active={meetupViewerId === id}
                  onPress={() => {
                    setMeetupViewerId(id);
                    setPreviewOpen(false);
                  }}
                />
              ))}
            </View>
            <Txt muted style={{ fontSize: 11, lineHeight: 16 }}>
              Try Noah to see what a non-friend can discover. His preview hides personal map pins.
            </Txt>
          </View>
        )}
      </View>
      {clusterIds && (
        <Button kind="secondary" onPress={() => navigate({ name: 'meetups' })}>
          Show all meetups
        </Button>
      )}
      <View style={{ gap: 8 }}>
        <View style={[ui.row, { gap: 6 }]}>
          <Icon name="map-pin" size={14} />
          <Txt weight="bold" style={{ fontSize: 12 }}>
            Meeting area
          </Txt>
        </View>
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
