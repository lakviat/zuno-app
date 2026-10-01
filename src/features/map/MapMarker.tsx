import { memo } from 'react';
import { meetupLifecycle } from '../meetups/domain';
import { Pressable, View } from 'react-native';
import { Avatar, Txt } from '../../components/ui';
import { useTheme } from '../../state/AppContext';
import { tokens } from '../../theme/tokens';
import type { Person, Meetup } from '../../types/domain';

export const FriendMarker = memo(function FriendMarker({
  person,
  selected,
  onPress,
  compact = false,
}: {
  person: Person;
  selected?: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Find ${person.profile.displayName}`}
      onPress={onPress}
      style={{ alignItems: 'center', width: 140, paddingBottom: 3 }}
    >
      {!compact && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 6,
            marginBottom: 7,
            ...tokens.shadow,
          }}
        >
          <Txt style={{ fontSize: 11 }} weight="medium">
            {person.presence.status}
          </Txt>
          <View
            style={{
              width: 8,
              height: 8,
              backgroundColor: colors.surface,
              position: 'absolute',
              bottom: -3,
              alignSelf: 'center',
              transform: [{ rotate: '45deg' }],
            }}
          />
        </View>
      )}
      <View
        style={{
          borderWidth: 3,
          borderColor: selected
            ? colors.accent
            : person.mapAudience === 'public'
              ? colors.green
              : colors.surface,
          padding: 3,
          borderRadius: 50,
          backgroundColor: person.profile.color,
          ...tokens.shadow,
          transform: [{ scale: selected ? 1.1 : 1 }],
        }}
      >
        <Avatar person={person} size={compact ? 38 : 52} />
        <View
          style={{
            position: 'absolute',
            bottom: -5,
            right: -8,
            width: 27,
            height: 27,
            borderRadius: 14,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Txt style={{ fontSize: 16 }}>{person.presence.emoji}</Txt>
        </View>
      </View>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 10,
          paddingVertical: 3,
          paddingHorizontal: 9,
          marginTop: 6,
        }}
      >
        <Txt weight="bold" style={{ fontSize: 11 }}>
          {person.profile.displayName.split(' ')[0]}
          {person.mapAudience === 'public' ? ' ≈' : ''}
        </Txt>
      </View>
    </Pressable>
  );
});
export const MeetupMarker = memo(function MeetupMarker({
  meetup,
  onPress,
  compact = false,
}: {
  meetup: Meetup;
  onPress: () => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open meetup ${meetup.title}`}
      onPress={onPress}
      style={{
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.accent,
        borderRadius: 14,
        padding: 9,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        ...tokens.shadow,
      }}
    >
      <Txt style={{ fontSize: 19 }}>{meetup.emoji}</Txt>
      <Txt weight="bold" numberOfLines={1} style={{ fontSize: 11, maxWidth: 165 }}>
        {compact ? meetup.participantIds.length : meetup.title}
      </Txt>
      {meetupLifecycle(meetup, Date.now()) === 'active' ? (
        <Txt weight="bold" style={{ fontSize: 9, color: colors.green }}>
          NOW
        </Txt>
      ) : (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
      )}
    </Pressable>
  );
});

export const MeetupClusterMarker = memo(function MeetupClusterMarker({
  count,
  onPress,
}: {
  count: number;
  onPress(): void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Browse ${count} nearby meetups`}
      onPress={onPress}
      style={{
        minWidth: 56,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        backgroundColor: colors.accent,
        borderWidth: 2,
        borderColor: colors.surface,
        borderRadius: 16,
        ...tokens.shadow,
      }}
    >
      <Txt weight="bold" style={{ color: 'white', fontSize: 16 }}>
        ☀ {count}
      </Txt>
    </Pressable>
  );
});
