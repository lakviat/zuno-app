import { memo } from 'react';
import { meetupLifecycle } from '../meetups/domain';
import { Pressable, View } from 'react-native';
import { Avatar, Txt } from '../../components/ui';
import { useTheme } from '../../state/AppContext';
import { tokens } from '../../theme/tokens';
import type { Person, Meetup } from '../../types/domain';
import { presencePresentation } from '../presence/presentation';
import { meetupMarkerSize, type MeetupDetail } from './meetupPresentation';

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
/** The bottom-center tip is the coordinate anchor in every presentation. */
function MeetupTip() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'center',
        width: 0,
        height: 0,
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderTopWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: colors.accent,
      }}
    />
  );
}

export const MeetupMarker = memo(function MeetupMarker({
  meetup,
  host,
  onPress,
  now,
  detail = 'detail',
}: {
  meetup: Meetup;
  host?: Person;
  onPress: () => void;
  now: number;
  detail?: MeetupDetail;
}) {
  const { colors } = useTheme();
  const hostName = host?.profile.displayName;
  const detailed = detail === 'detail';
  const overview = detail === 'overview';
  return (
    <Pressable
      testID={`meetup-pin-${meetup.id}-${detail}`}
      accessibilityRole="button"
      accessibilityLabel={`Open meetup ${meetup.title}`}
      accessibilityHint={`${hostName ? `Hosted by ${hostName}` : 'Host unavailable'} · ${meetup.participantIds.length} going`}
      onPress={onPress}
      style={{
        ...meetupMarkerSize(detail),
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: detailed ? 135 : overview ? 26 : 58,
          height: detailed ? 64 : overview ? 26 : 36,
          backgroundColor: colors.surface,
          borderWidth: 2,
          borderColor: colors.accent,
          borderRadius: detailed ? 14 : 18,
          paddingHorizontal: detailed ? 9 : 3,
          paddingTop: detailed ? 15 : 0,
          justifyContent: 'center',
          gap: 2,
          ...tokens.shadow,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: detailed ? 'flex-start' : 'center',
            gap: 4,
          }}
        >
          {!detailed && !overview && host && <Avatar person={host} size={22} />}
          <Txt style={{ fontSize: overview ? 13 : 17 }} maxFontSizeMultiplier={1.2}>
            {meetup.emoji}
          </Txt>
          {detailed && (
            <>
              <Txt
                weight="bold"
                numberOfLines={1}
                style={{ fontSize: 10, flexShrink: 1 }}
                maxFontSizeMultiplier={1.2}
              >
                {meetup.participantIds.length} going
              </Txt>
              {meetupLifecycle(meetup, now) === 'active' ? (
                <Txt
                  weight="bold"
                  style={{ fontSize: 9, color: colors.green }}
                  maxFontSizeMultiplier={1.2}
                >
                  NOW
                </Txt>
              ) : (
                <View
                  style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent }}
                />
              )}
            </>
          )}
        </View>
        {detailed && (
          <Txt
            muted
            weight="medium"
            numberOfLines={1}
            style={{ fontSize: 10 }}
            maxFontSizeMultiplier={1.2}
          >
            {hostName ? `By ${hostName}` : 'Host unavailable'}
          </Txt>
        )}
      </View>
      <MeetupTip />
      {detailed && host && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 9,
            padding: 2,
            borderRadius: 20,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.accent,
          }}
        >
          <Avatar person={host} size={27} />
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
      accessibilityHint="Opens all meetups in this group. Zoom in to separate their pins."
      onPress={onPress}
      style={{ ...meetupMarkerSize('cluster'), justifyContent: 'flex-end', alignItems: 'center' }}
    >
      <View
        style={{
          height: 34,
          minWidth: 40,
          paddingHorizontal: 5,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.accent,
          borderWidth: 2,
          borderColor: colors.surface,
          borderRadius: 17,
          ...tokens.shadow,
        }}
      >
        <Txt weight="bold" style={{ color: 'white', fontSize: 12 }} maxFontSizeMultiplier={1.2}>
          {count}
        </Txt>
      </View>
      <MeetupTip />
    </Pressable>
  );
});
