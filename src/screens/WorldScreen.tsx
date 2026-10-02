import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { ActivityIndicator, BackHandler, Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Chip, Icon, IconButton, Txt, ui } from '../components/ui';
import { useApp } from '../state/AppContext';
import { AvailabilityScreen } from '../features/presence/AvailabilityScreen';
import { discoverablePeople, isAvailable } from '../features/presence/domain';
import { MeetupChat } from '../features/chat/MeetupChat';
import { LocationPicker } from '../features/meetups/LocationPicker';
import { mapPlace } from '../features/meetups/mapPlace';
import { MIAMI } from '../features/map/types';
import type { Coordinate } from '../types/domain';
import type { MapViewport } from '../utils/geo';
import { SocialMap } from '../features/map/SocialMap';
import type { MapHandle } from '../features/map/types';
import { EdgeZoom } from '../features/map/EdgeZoom';
import { ScreenEdgeZoom } from '../features/map/ScreenEdgeZoom';
import { FriendCard } from '../features/friends/FriendCard';
import { FriendsScreen } from '../features/friends/FriendsScreen';
import { ChatScreen } from '../features/chat/ChatScreen';
import { MeetupsScreen } from '../features/meetups/MeetupsScreen';
import { MeetupForm } from '../features/meetups/MeetupForm';
import { demoAreas } from '../features/meetups/places';
import { listVisibleMeetups } from '../features/meetups/domain';
import { AccountScreen } from '../features/account/AccountScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { PrivacyScreen } from '../features/privacy/PrivacyScreen';
import { BottomNav, Header, MobilePeoplePill, WorldPanel } from './HomeChrome';
import { SheetHost } from '../components/Sheet';
import type { Route } from '../navigation/routes';
import { tokens } from '../theme/tokens';
import { motionStore, useMotion } from '../features/location/store';

export function WorldScreen() {
  const {
    now,
    cloud,
    signedIn,
    syncError,
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
    setMeetupViewport,
  } = useApp();
  const [route, setRoute] = useState<Route>(() =>
    cloud && !signedIn ? { name: 'account' } : { name: 'map' },
  );
  const [selected, setSelected] = useState<string>();
  const [placing, setPlacing] = useState<{ friendId?: string }>();
  const [moving, setMoving] = useState(false);
  const [viewport, setViewport] = useState<MapViewport>({
    ...MIAMI,
    latitudeDelta: 0.06,
    longitudeDelta: 0.05,
  });
  const onViewportChange = useCallback(
    (next: MapViewport) => {
      setViewport(next);
      setMeetupViewport(next);
      setMoving(false);
    },
    [setMeetupViewport],
  );
  const onMoving = useCallback(() => setMoving(true), []);
  const [filter, setFilter] = useState<'all' | 'free' | 'meetups'>('all');
  const { width, height } = useWindowDimensions();
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
      if (cloud && !signedIn && next.name !== 'account' && next.name !== 'map') {
        setRoute({ name: 'account' });
        return;
      }
      if (next.name === 'create-meetup' && next.friendId) setMeetupViewerId(state.currentUserId);
      if (next.name === 'create-meetup' && !next.place) {
        setSelected(undefined);
        setPlacing({ friendId: next.friendId });
        setMoving(false);
        setRoute({ name: 'map' });
        return;
      }
      if (next.name === 'create-meetup' && next.place) setFilter('all');
      if (next.name === 'map' && next.coordinate) map.current?.recenter(next.coordinate);
      setPlacing(undefined);
      setRoute(next);
    },
    [setMeetupViewerId, state.currentUserId, cloud, signedIn],
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
  const eligiblePeople = useMemo(() => discoverablePeople(state, now), [state, now]);
  const person = personalView ? eligiblePeople.find((f) => f.user.id === selected) : undefined;
  const meetups = useMemo(
    () => (filter === 'free' ? [] : listVisibleMeetups(state, meetupViewerId, { now, viewport })),
    [state, meetupViewerId, now, viewport, filter],
  );
  const mapPeople = useMemo(
    () =>
      filter === 'meetups' || !personalView
        ? []
        : eligiblePeople.filter((f) => filter !== 'free' || isAvailable(f.presence, now)),
    [filter, personalView, eligiblePeople, now],
  );
  const ownFix = useMotion(state.currentUserId);
  const mapMe = useMemo(() => {
    if (!personalView) return { ...me, location: undefined };
    if (!ownFix || now - ownFix.timestamp > 90000) return me;
    return {
      ...me,
      location: {
        userId: me.user.id,
        coordinate: ownFix.coordinate,
        accuracyMeters: ownFix.accuracy,
        updatedAt: new Date(ownFix.timestamp).toISOString(),
        place: 'Your location',
        precision: 'precise' as const,
      },
    };
  }, [personalView, me, ownFix, now]);
  const onMeetupPress = useCallback(
    (meetupId: string) => navigate({ name: 'meetups', meetupId }),
    [navigate],
  );
  const onMeetupClusterPress = useCallback(
    (clusterIds: string[]) => navigate({ name: 'meetups', clusterIds }),
    [navigate],
  );
  const onLongPress = useCallback((coordinate: Coordinate) => {
    map.current?.recenter(coordinate);
    setSelected(undefined);
    setPlacing({});
    setRoute({ name: 'map' });
  }, []);
  const selectPerson = useCallback(
    (id: string) => {
      map.current?.endZoom();
      setSelected(id);
      if (filter === 'meetups') setFilter('all');
    },
    [filter],
  );
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
        people={mapPeople}
        me={mapMe}
        meetups={meetups}
        dark={dark}
        selectedId={selected}
        onPersonPress={selectPerson}
        onMeetupPress={onMeetupPress}
        onMeetupClusterPress={onMeetupClusterPress}
        onViewportChange={onViewportChange}
        onMoving={onMoving}
        onLongPress={onLongPress}
      />
      {Platform.OS === 'ios' && route.name === 'map' && (
        <ScreenEdgeZoom
          top={insets.top + (wide ? 86 : 70)}
          bottom={bottom + 86}
          height={height}
          leftInset={insets.left}
          rightInset={insets.right}
          onZoom={zoomMap}
          onBegin={beginZoom}
          onUpdate={updateZoom}
          onEnd={endZoom}
        />
      )}
      <Header wide={wide} top={insets.top} navigate={navigate} />
      {wide && personalView && !placing && (
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
      {route.name === 'map' && !placing && (!person || wide) && (
        <View
          style={{
            position: 'absolute',
            right: Math.max(insets.right + 16, wide ? 28 : 16),
            top: Platform.OS === 'ios' ? undefined : '39%',
            bottom: Platform.OS === 'ios' ? bottom + 152 : undefined,
            gap: 10,
            alignItems: 'center',
          }}
        >
          {Platform.OS !== 'ios' && (
            <EdgeZoom onZoom={zoomMap} onBegin={beginZoom} onUpdate={updateZoom} onEnd={endZoom} />
          )}
          <IconButton
            name="plus"
            label="Create meetup on map"
            active
            onPress={() => navigate({ name: 'create-meetup' })}
            style={tokens.shadow}
          />
          <IconButton
            name="zap"
            label="Set my availability"
            onPress={() => navigate({ name: 'availability' })}
            style={tokens.shadow}
          />
          <IconButton
            name="navigation"
            label={cloud ? 'Recenter map' : 'Recenter demo map'}
            onPress={() => {
              const sample = motionStore.get(state.currentUserId);
              map.current?.recenter(
                sample && Date.now() - sample.timestamp < 90000 ? sample.coordinate : undefined,
              );
            }}
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
        !wide &&
        personalView &&
        !placing && <MobilePeoplePill bottom={bottom + 88} navigate={navigate} />
      )}
      {!placing && <BottomNav wide={wide} bottom={bottom} navigate={navigate} />}
      {placing && (
        <LocationPicker
          viewport={viewport}
          moving={moving}
          bottom={bottom + 16}
          onCancel={() => setPlacing(undefined)}
          onConfirm={() =>
            navigate({
              name: 'create-meetup',
              friendId: placing.friendId,
              place: mapPlace(viewport),
            })
          }
        />
      )}
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
          <Txt style={{ color: colors.surface, fontSize: 12 }}>{toast || syncError}</Txt>
        </View>
      )}
      <SheetHost visible={route.name !== 'map'} onClose={() => navigate({ name: 'map' })}>
        {route.name === 'account' && <AccountScreen navigate={navigate} />}
        {route.name === 'availability' && <AvailabilityScreen navigate={navigate} />}
        {route.name === 'meetup-chat' && (
          <MeetupChat key={route.meetupId} meetupId={route.meetupId} navigate={navigate} />
        )}
        {route.name === 'friends' && <FriendsScreen navigate={navigate} />}
        {route.name === 'inbox' && (
          <ChatScreen
            key={route.friendId ?? 'inbox'}
            friendId={route.friendId}
            navigate={navigate}
          />
        )}
        {route.name === 'meetups' && (
          <MeetupsScreen
            meetupId={route.meetupId}
            clusterIds={route.clusterIds}
            navigate={navigate}
          />
        )}
        {route.name === 'create-meetup' && (
          <MeetupForm
            key="create"
            friendId={route.friendId}
            place={route.place}
            navigate={navigate}
          />
        )}
        {route.name === 'edit-meetup' && (
          <MeetupForm key={route.meetupId} meetupId={route.meetupId} navigate={navigate} />
        )}
        {route.name === 'profile' && (
          <ProfileScreen key={route.userId ?? 'me'} userId={route.userId} navigate={navigate} />
        )}
        {route.name === 'privacy' && <PrivacyScreen navigate={navigate} />}
      </SheetHost>
    </View>
  );
}
