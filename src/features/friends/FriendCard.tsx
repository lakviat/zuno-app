import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { Avatar, Button, Icon, IconButton, Txt, ui } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { tokens } from '../../theme/tokens';
import type { Navigate } from '../../navigation/routes';
import type { Person } from '../../types/domain';
import { useMotion } from '../location/store';
import { motionLabel } from '../location/motion';
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
        <Avatar person={person} size={57} online={person.presence.freeNow} />
        <View style={{ flex: 1, gap: 5 }}>
          <Txt weight="display" style={{ fontSize: 24 }}>
            {person.profile.displayName.split(' ')[0]}
          </Txt>
          <Txt muted style={{ fontSize: 11 }}>
            {person.presence.emoji} {person.presence.status}
          </Txt>
        </View>
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
          {person.mapAudience === 'public'
            ? person.location?.precision === 'approximate'
              ? '· Public · approximate'
              : '· Public'
            : '· Friend'}
        </Txt>
      </View>
      {sample && (
        <Txt style={{ marginTop: 10, fontSize: 12 }}>
          {motionLabel(sample, state.discovery.units ?? 'mph', now)} ·{' '}
          {now - sample.timestamp < 90000 ? 'Updated now' : 'Last known'}
        </Txt>
      )}
      {!!person.presence.intent && <Txt style={{ marginTop: 8 }}>{person.presence.intent}</Txt>}
      <View style={[ui.row, { gap: 8, marginTop: 18 }]}>
        <Button
          style={{ flex: 1 }}
          icon="message-circle"
          onPress={() =>
            navigate(
              person.mapAudience === 'public'
                ? { name: 'profile', userId: person.user.id }
                : { name: 'inbox', friendId: person.user.id },
            )
          }
        >
          {person.mapAudience === 'public' ? 'View profile' : 'Say hello'}
        </Button>
        <Button
          kind="secondary"
          icon="plus"
          onPress={() =>
            navigate({
              name: 'create-meetup',
              friendId: person.mapAudience === 'public' ? undefined : person.user.id,
            })
          }
        >
          Meetup
        </Button>
      </View>
      <Button
        kind="quiet"
        style={{ minHeight: 30, marginTop: 9 }}
        onPress={() => navigate({ name: 'profile', userId: person.user.id })}
      >
        A little more about them ↗
      </Button>
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
