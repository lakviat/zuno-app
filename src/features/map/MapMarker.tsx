import { Pressable, View } from 'react-native';
import { Avatar, Txt } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { tokens } from '../../theme/tokens';
import type { Person, Plan } from '../../types/domain';

export function FriendMarker({
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
  const { colors } = useApp();
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
          borderColor: selected ? colors.accent : colors.surface,
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
        </Txt>
      </View>
    </Pressable>
  );
}
export function PlanMarker({
  plan,
  onPress,
  compact = false,
}: {
  plan: Plan;
  onPress: () => void;
  compact?: boolean;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open plan ${plan.title}`}
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
      <Txt style={{ fontSize: 19 }}>{plan.emoji}</Txt>
      <Txt weight="bold" style={{ fontSize: 11 }}>
        {compact ? plan.participants.length : plan.title}
      </Txt>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
    </Pressable>
  );
}
