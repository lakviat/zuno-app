import { presenceText } from '../presence/presentation';
import { useEffect, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Avatar, Button, Icon, IconButton, Txt, ui } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { tokens } from '../../theme/tokens';
import type { Navigate } from '../../navigation/routes';
import type { Person } from '../../types/domain';
import { useMotion } from '../location/store';
import { motionLabel } from '../location/motion';
import { isFriend } from '../../utils/privacy';
import { FriendshipActions } from './FriendshipActions';
import { profileDistance } from '../profile/details';
export function FriendCard({
  person,
  wide,
  bottom,
  onClose,
  navigate,
}: {
  person: Person;
  wide: boolean;
  bottom: number;
  onClose: () => void;
  navigate: Navigate;
}) {
  const { colors, state, now, dispatch } = useApp();
  const sample = useMotion(person.user.id, person.location?.precision === 'precise');
  const device = useMotion(state.currentUserId);
  const distance = profileDistance(state, person.user.id, now, device);
  const friend = isFriend(state, person.user.id);
  const openProfile = () => navigate({ name: 'profile', userId: person.user.id });
  const reduced = useReducedMotion();
  const [animation] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) {
      animation.setValue(1);
      return;
    }
    animation.setValue(0);
    Animated.spring(animation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 14,
    }).start();
  }, [animation, person.user.id, reduced]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom,
        right: wide ? 90 : 16,
        left: wide ? undefined : 16,
        width: wide ? 320 : undefined,
        backgroundColor: colors.surface,
        padding: 22,
        borderRadius: 27,
        opacity: animation,
        transform: [
          { translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
        ],
        ...tokens.shadow,
      }}
    >
      <View style={[ui.row, { gap: 13 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${person.profile.displayName}'s profile`}
          onPress={openProfile}
          style={[ui.row, { flex: 1, gap: 13 }]}
        >
          <Avatar person={person} size={57} online={person.presence.freeNow} />
          <View style={{ flex: 1, gap: 5 }}>
            <Txt weight="display" style={{ fontSize: 24 }}>
              {person.profile.displayName.split(' ')[0]}
            </Txt>
            <Txt muted style={{ fontSize: 11 }}>
              {presenceText(person.presence, now)}
            </Txt>
          </View>
        </Pressable>
        <IconButton
          label="Close friend card"
          name="x"
          onPress={onClose}
          style={{ width: 30, height: 30, backgroundColor: colors.raised }}
        />
      </View>
      <View style={[ui.row, { marginTop: 17, gap: 6 }]}>
        <Icon name="map-pin" size={12} color={colors.muted} />
        <Txt muted style={{ fontSize: 11 }}>
          {person.location?.place ?? 'Location is private'}
        </Txt>
        <Txt muted style={{ fontSize: 11 }}>
          {!friend
            ? person.location?.precision === 'approximate'
              ? '· Public · approximate'
              : '· Public'
            : '· Friend'}
        </Txt>
      </View>
      {!!distance && (
        <Txt muted style={{ marginTop: 8, fontSize: 12 }}>
          {distance}
        </Txt>
      )}
      {sample && (
        <Txt style={{ marginTop: 10, fontSize: 12 }}>
          {motionLabel(sample, state.discovery.units ?? 'mph', now)} ·{' '}
          {now - sample.timestamp < 90000 ? 'Updated now' : 'Last known'}
        </Txt>
      )}
      <View style={[ui.row, { gap: 8, marginTop: 18 }]}>
        <Button
          style={{ flex: 1 }}
          icon="message-circle"
          onPress={() =>
            navigate(
              !friend
                ? { name: 'profile', userId: person.user.id }
                : { name: 'inbox', friendId: person.user.id },
            )
          }
        >
          {!friend ? 'View profile' : 'Say hello'}
        </Button>
        <Button
          kind="secondary"
          icon="plus"
          onPress={() =>
            navigate({
              name: 'create-meetup',
              friendId: friend ? person.user.id : undefined,
            })
          }
        >
          Meetup
        </Button>
      </View>
      <View style={{ marginTop: 9 }}>
        <FriendshipActions key={person.user.id} userId={person.user.id} onManage={openProfile} />
      </View>
      {person.mapAudience === 'public' && (
        <Button
          kind="quiet"
          onPress={() => {
            dispatch({
              type: 'discovery',
              value: { hiddenUserIds: [...(state.discovery.hiddenUserIds ?? []), person.user.id] },
            });
            onClose();
          }}
        >
          Hide from my map
        </Button>
      )}
    </Animated.View>
  );
}
