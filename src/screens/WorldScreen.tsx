import { useCallback, useRef, useState, useEffect } from 'react';
import { ActivityIndicator, BackHandler, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Chip, Icon, IconButton, Txt, ui } from '../components/ui';
import { useApp } from '../state/AppContext';
import { SocialMap } from '../features/map/SocialMap';
import type { MapHandle } from '../features/map/types';
import { EdgeZoom } from '../features/map/EdgeZoom';
import { FriendCard } from '../features/friends/FriendCard';
import { FriendsScreen } from '../features/friends/FriendsScreen';
import { ChatScreen } from '../features/chat/ChatScreen';
import { MeetupsScreen } from '../features/meetups/MeetupsScreen';
import { MeetupForm } from '../features/meetups/MeetupForm';
import { demoAreas } from '../features/meetups/places';
import { listVisibleMeetups } from '../features/meetups/domain';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { PrivacyScreen } from '../features/privacy/PrivacyScreen';
import { BottomNav, Header, MobilePeoplePill, WorldPanel } from './HomeChrome';
import type { Route } from '../navigation/routes';
import { tokens } from '../theme/tokens';

export function WorldScreen() {
  const {
    now,
    ready,
    friends,
    me,
    state,
    dark,
    colors,
    toast,
    dispatch,
    meetupViewerId,
    setMeetupViewerId,
    meetupAreaId,
  } = useApp();
  const [route, setRoute] = useState<Route>({ name: 'map' });
  const [selected, setSelected] = useState<string>();
  const [filter, setFilter] = useState<'all' | 'free' | 'meetups'>('all');
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const map = useRef<MapHandle>(null);
  const previousArea = useRef(meetupAreaId);
  useEffect(() => {
    if (previousArea.current !== meetupAreaId) {
      previousArea.current = meetupAreaId;
      map.current?.recenter(demoAreas.find((a) => a.id === meetupAreaId)?.coordinate);
    }
  }, [meetupAreaId]);
  const wide = width >= 1000;
  const top = insets.top + (wide ? 110 : 88);
  const bottom = Math.max(insets.bottom, wide ? 26 : 16);
  const zoomMap = useCallback((delta: number) => map.current?.zoomBy(delta), []);
  const beginZoom = useCallback(() => map.current?.beginZoom(), []);
  const updateZoom = useCallback((delta: number) => map.current?.updateZoom(delta), []);
  const endZoom = useCallback((commitPending?: boolean) => map.current?.endZoom(commitPending), []);
  const navigate = useCallback(
    (next: Route) => {
      map.current?.endZoom();
      if (next.name === 'create-meetup' && next.friendId) setMeetupViewerId(state.currentUserId);
      setRoute(next);
    },
    [setMeetupViewerId, state.currentUserId],
  );
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route.name !== 'map') {
        setRoute({ name: 'map' });
        return true;
      }
      if (selected) {
        setSelected(undefined);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [route.name, selected]);
  const personalView = meetupViewerId === state.currentUserId;
  const person = personalView ? friends.find((f) => f.user.id === selected) : undefined;
  const meetups = listVisibleMeetups(state, meetupViewerId, { now, areaId: meetupAreaId });
  const selectPerson = (id: string) => {
    map.current?.endZoom();
    setSelected(id);
    if (filter === 'meetups') setFilter('all');
  };
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
          gap: 18,
        }}
      >
        <ActivityIndicator color={colors.accent} />
        <Txt muted>Getting your people together…</Txt>
      </View>
    );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <SocialMap
        ref={map}
        people={
          filter === 'meetups' || meetupViewerId !== state.currentUserId
            ? []
            : friends.filter((f) => filter !== 'free' || f.presence.freeNow)
        }
        me={meetupViewerId === state.currentUserId ? me : { ...me, location: undefined }}
        meetups={meetups}
        dark={dark}
        selectedId={selected}
        onPersonPress={selectPerson}
        onMeetupPress={(meetupId) => navigate({ name: 'meetups', meetupId })}
        onMeetupClusterPress={(clusterIds) => navigate({ name: 'meetups', clusterIds })}
      />
      <Header wide={wide} top={insets.top} navigate={navigate} />
      {wide && personalView && (
        <WorldPanel top={top} navigate={navigate} selectPerson={selectPerson} />
      )}
      <View
        style={[
          ui.row,
          {
            position: 'absolute',
            top: top + 2,
            left: wide ? 350 : 16,
            right: wide ? undefined : 16,
            justifyContent: wide ? 'flex-start' : 'center',
            gap: 7,
          },
        ]}
      >
        <Chip
          compact={!wide}
          label="Everyone"
          icon="users"
          active={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <Chip
          compact={!wide}
          label="Free now"
          icon="zap"
          active={filter === 'free'}
          onPress={() => setFilter('free')}
        />
        <Chip
          label="Meetups"
          accessibilityLabel="Meetups nearby"
          compact={!wide}
          icon="sun"
          active={filter === 'meetups'}
          onPress={() => setFilter('meetups')}
        />
      </View>
      {meetupViewerId !== state.currentUserId && (
        <View style={{ position: 'absolute', top: top + 52, alignSelf: 'center' }}>
          <Chip
            label="Meetups preview · Noah"
            icon="eye"
            onPress={() => navigate({ name: 'meetups' })}
          />
        </View>
      )}
      {wide && (
        <View
          style={[
            ui.row,
            {
              position: 'absolute',
              top: top + 4,
              right: 28,
              gap: 7,
              backgroundColor: colors.surface,
              paddingVertical: 11,
              paddingHorizontal: 15,
              borderRadius: 99,
            },
          ]}
        >
          <View style={{ width: 6, height: 6, borderRadius: 4, backgroundColor: colors.green }} />
          <Txt weight="medium" style={{ fontSize: 11 }}>
            {friends.length} people in your world
          </Txt>
        </View>
      )}
      {route.name === 'map' && (!person || wide) && (
        <View
          style={{
            position: 'absolute',
            right: Math.max(insets.right + 16, wide ? 28 : 16),
            top: '39%',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <EdgeZoom onZoom={zoomMap} onBegin={beginZoom} onUpdate={updateZoom} onEnd={endZoom} />
          <IconButton
            name="navigation"
            label="Recenter demo map"
            onPress={() => map.current?.recenter()}
            style={tokens.shadow}
          />
        </View>
      )}
      {person ? (
        <FriendCard
          person={person}
          wide={wide}
          bottom={bottom + 92}
          navigate={navigate}
          onClose={() => setSelected(undefined)}
        />
      ) : (
        !wide && personalView && <MobilePeoplePill bottom={bottom + 88} navigate={navigate} />
      )}
      <BottomNav wide={wide} bottom={bottom} navigate={navigate} />
      {wide && (
        <View style={[ui.row, { position: 'absolute', left: 32, bottom: 35, gap: 7 }]}>
          <Icon name="heart" size={12} color={colors.muted} />
          <Txt muted style={{ fontSize: 10 }}>
            A little world. A lot of possibilities.
          </Txt>
        </View>
      )}
      {wide && (
        <View style={{ position: 'absolute', right: 30, bottom: 41 }}>
          <Chip
            label={state.privacy.ghostMode ? 'Ghost mode on' : 'Your location is private'}
            icon="eye-off"
            active={state.privacy.ghostMode}
            onPress={() =>
              dispatch({
                type: 'privacy',
                value: { ...state.privacy, ghostMode: !state.privacy.ghostMode },
              })
            }
          />
        </View>
      )}
      {toast !== '' && route.name === 'map' && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: top + 60,
            alignSelf: 'center',
            maxWidth: '85%',
            padding: 15,
            borderRadius: 16,
            backgroundColor: colors.ink,
            ...tokens.shadow,
          }}
        >
          <Txt style={{ color: colors.surface, fontSize: 12 }}>{toast}</Txt>
        </View>
      )}
      {route.name === 'friends' && <FriendsScreen navigate={navigate} />}
      {route.name === 'inbox' && <ChatScreen friendId={route.friendId} navigate={navigate} />}
      {route.name === 'meetups' && (
        <MeetupsScreen
          meetupId={route.meetupId}
          clusterIds={route.clusterIds}
          navigate={navigate}
        />
      )}
      {route.name === 'create-meetup' && (
        <MeetupForm key="create" friendId={route.friendId} navigate={navigate} />
      )}
      {route.name === 'edit-meetup' && (
        <MeetupForm key={route.meetupId} meetupId={route.meetupId} navigate={navigate} />
      )}
      {route.name === 'profile' && (
        <ProfileScreen key={route.userId ?? 'me'} userId={route.userId} navigate={navigate} />
      )}
      {route.name === 'privacy' && <PrivacyScreen navigate={navigate} />}
    </View>
  );
}
