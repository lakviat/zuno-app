import { memo } from 'react';
import { meetupLifecycle } from '../meetups/domain';
import { Pressable, View } from 'react-native';
import { Avatar, Txt } from '../../components/ui';
import { useTheme } from '../../state/AppContext';
import { tokens } from '../../theme/tokens';
import type { Person, Meetup } from '../../types/domain';
import { presencePresentation } from '../presence/presentation';

export const FriendMarker = memo(function FriendMarker({
  person,
  selected,
  onPress,
  compact = false,
  now,
}: {
  person: Person;
  selected?: boolean;
  onPress: () => void;
  compact?: boolean;
  now?: number;
}) {
  const { colors } = useTheme();
  const presence = presencePresentation(person.presence, now);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Find ${person.profile.displayName}`}
      accessibilityHint={`${presence.emoji} ${presence.status}`}
      onPress={onPress}
      style={{ alignItems: 'center', width: compact ? 72 : 140, paddingBottom: 3 }}
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
            {presence.status}
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
          <Txt style={{ fontSize: 16 }} accessibilityLabel={presence.status}>
            {presence.emoji}
          </Txt>
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
        <Txt weight="bold" numberOfLines={1} style={{ fontSize: 11 }}>
          {person.profile.displayName.split(' ')[0]}
          {person.location?.precision === 'approximate' ? ' ≈' : ''}
        </Txt>
      </View>
    </Pressable>
  );
});
export const MeetupMarker = memo(function MeetupMarker({
  meetup,
  host,
  onPress,
  compact = false,
}: {
  meetup: Meetup;
  host?: Person;
  onPress: () => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const hostName = host?.profile.displayName;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open meetup ${meetup.title}`}
      accessibilityHint={hostName ? `Hosted by ${hostName}` : 'Host unavailable'}
      onPress={onPress}
      style={{ paddingTop: host ? 16 : 0, maxWidth: compact ? 150 : 235 }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 2,
          borderColor: colors.accent,
          borderRadius: 16,
          padding: 10,
          paddingTop: host ? 19 : 10,
          gap: 5,
          ...tokens.shadow,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt style={{ fontSize: 19 }}>{meetup.emoji}</Txt>
          <Txt weight="bold" numberOfLines={1} style={{ fontSize: 11, flexShrink: 1 }}>
            {compact ? `${meetup.participantIds.length} going` : meetup.title}
          </Txt>
          {meetupLifecycle(meetup, Date.now()) === 'active' ? (
            <Txt weight="bold" style={{ fontSize: 9, color: colors.green }}>
              NOW
            </Txt>
          ) : (
            <View
              style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }}
            />
          )}
        </View>
        <Txt muted weight="medium" numberOfLines={1} style={{ fontSize: 11 }}>
          {hostName ? `By ${hostName}` : 'Host unavailable'}
        </Txt>
      </View>
      {host && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 10,
            padding: 2,
            borderRadius: 22,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.accent,
          }}
        >
          <Avatar person={host} size={30} />
        </View>
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
