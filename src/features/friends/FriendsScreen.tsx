import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Button, Chip, EmptyState, Field, Icon, Txt, ui } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useApp } from '../../state/AppContext';
import { isBlocked } from '../../utils/privacy';
import type { Navigate } from '../../navigation/routes';

export function FriendsScreen({ navigate }: { navigate: Navigate }) {
  const { state, friends, dispatch, colors } = useApp();
  const [tab, setTab] = useState('Your friends');
  const [search, setSearch] = useState('');
  const requests = state.friendships.filter((f) => f.status === 'pending');
  const people = (
    tab === 'Your friends'
      ? friends
      : state.people.filter(
          (p) =>
            p.user.id !== state.currentUserId &&
            !isBlocked(state, p.user.id) &&
            (tab === 'Requests'
              ? requests.some((f) => [f.requesterId, f.addresseeId].includes(p.user.id))
              : !friends.some((f) => f.user.id === p.user.id)),
        )
  ).filter((p) =>
    `${p.profile.displayName} ${p.profile.username}`.toLowerCase().includes(search.toLowerCase()),
  );
  const act = (id: string, operation: 'add' | 'accept' | 'remove') =>
    dispatch({ type: 'friend', id, operation, now: new Date().toISOString() });
  return (
    <Sheet
      title="Your people"
      subtitle={`${friends.length} friends. A whole world of possibilities.`}
      onClose={() => navigate({ name: 'map' })}
    >
      <Field
        placeholder="Find a familiar face…"
        accessibilityLabel="Search friends"
        value={search}
        onChangeText={setSearch}
      />
      <View style={[ui.row, { gap: 7 }]}>
        {['Your friends', 'Requests', 'Find people'].map((t) => (
          <Chip
            key={t}
            label={t === 'Requests' ? `Requests (${requests.length})` : t}
            active={t === tab}
            onPress={() => setTab(t)}
          />
        ))}
      </View>
      {people.length === 0 && (
        <EmptyState
          icon="users"
          title="A little quiet here"
          body={
            search
              ? 'Try another name or username.'
              : 'You’re all caught up. Find someone new to add to your world.'
          }
        />
      )}
      {people.map((person) => {
        const request = requests.find((f) =>
          [f.requesterId, f.addresseeId].includes(person.user.id),
        );
        const incoming = request?.addresseeId === state.currentUserId;
        return (
          <View key={person.user.id} style={[ui.row, { gap: 12, paddingVertical: 5 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${person.profile.displayName}`}
              onPress={() => navigate({ name: 'profile', userId: person.user.id })}
            >
              <Avatar person={person} size={52} online={person.presence.freeNow} />
            </Pressable>
            <Pressable
              onPress={() => navigate({ name: 'profile', userId: person.user.id })}
              style={{ flex: 1 }}
            >
              <Txt weight="bold">{person.profile.displayName}</Txt>
              <Txt muted style={{ fontSize: 12, marginTop: 5 }}>
                {tab === 'Your friends'
                  ? `${person.presence.emoji} ${person.presence.status}`
                  : `@${person.profile.username}`}
              </Txt>
            </Pressable>
            {tab === 'Your friends' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Message ${person.profile.displayName}`}
                onPress={() => navigate({ name: 'inbox', friendId: person.user.id })}
                style={{ padding: 12 }}
              >
                <Icon name="message-circle" color={colors.muted} />
              </Pressable>
            ) : request ? (
              <View style={{ gap: 4 }}>
                {incoming ? (
                  <Button onPress={() => act(person.user.id, 'accept')}>Accept</Button>
                ) : (
                  <Txt muted style={{ fontSize: 12 }}>
                    Request sent
                  </Txt>
                )}
                <Button kind="quiet" onPress={() => act(person.user.id, 'remove')}>
                  {incoming ? 'Decline' : 'Cancel'}
                </Button>
              </View>
            ) : (
              <Button icon="plus" kind="secondary" onPress={() => act(person.user.id, 'add')}>
                Add
              </Button>
            )}
          </View>
        );
      })}
      {tab === 'Find people' && (
        <Txt muted style={{ fontSize: 12, lineHeight: 19 }}>
          Search the demo directory by name. People outside your circle never show a location.
        </Txt>
      )}
    </Sheet>
  );
}
