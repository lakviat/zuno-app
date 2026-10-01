import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type TextInputProps,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useApp } from '../state/AppContext';
import { tokens } from '../theme/tokens';
import { avatars } from '../mocks/avatars';
import type { Person } from '../types/domain';

export type IconName = React.ComponentProps<typeof Feather>['name'];
export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const { colors } = useApp();
  return <Feather name={name} size={size} color={color ?? colors.ink} />;
}
export function Txt({
  children,
  style,
  muted = false,
  weight = 'body',
  ...props
}: React.ComponentProps<typeof Text> & { muted?: boolean; weight?: keyof typeof tokens.font }) {
  const { colors } = useApp();
  return (
    <Text
      {...props}
      style={[
        { fontFamily: tokens.font[weight], fontSize: 14, color: muted ? colors.muted : colors.ink },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Avatar({
  person,
  size = 48,
  online = false,
}: {
  person: Person;
  size?: number;
  online?: boolean;
}) {
  const { colors } = useApp();
  const source = avatars[person.profile.avatar];
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          backgroundColor: person.profile.color,
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
        }}
      >
        {source ? (
          <Image
            source={source}
            style={{ width: size, height: size }}
            accessibilityLabel={person.profile.displayName}
          />
        ) : (
          <Txt
            weight="display"
            style={{ textAlign: 'center', lineHeight: size, fontSize: size / 2.5 }}
          >
            {person.profile.displayName
              .split(' ')
              .map((s) => s[0])
              .join('')}
          </Txt>
        )}
      </View>
      {online && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 13,
            height: 13,
            borderRadius: 8,
            backgroundColor: colors.green,
            borderWidth: 3,
            borderColor: colors.surface,
          }}
        />
      )}
    </View>
  );
}
export function Button({
  children,
  onPress,
  icon,
  kind = 'primary',
  disabled,
  style,
}: {
  children: string;
  onPress: () => void;
  icon?: IconName;
  kind?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useApp();
  const color = kind === 'primary' ? '#FFFFFF' : kind === 'danger' ? colors.accent : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={children}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 46,
          paddingHorizontal: 18,
          borderRadius: tokens.radius.md,
          backgroundColor:
            kind === 'primary'
              ? colors.accent
              : kind === 'secondary'
                ? colors.raised
                : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} color={color} size={17} />}
      <Txt weight="bold" style={{ color, fontSize: 13 }}>
        {children}
      </Txt>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  style,
  active = false,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  active?: boolean;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? colors.accentSoft : colors.surface,
          opacity: pressed ? 0.65 : 1,
        },
        style,
      ]}
    >
      <Icon name={name} color={active ? colors.accent : colors.ink} />
    </Pressable>
  );
}
export function Chip({
  label,
  accessibilityLabel,
  compact = false,
  icon,
  active,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  compact?: boolean;
  icon?: IconName;
  active?: boolean;
  onPress: () => void;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        paddingHorizontal: compact ? 12 : 15,
        borderRadius: 99,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        backgroundColor: active ? colors.ink : colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon && <Icon name={icon} size={15} color={active ? colors.surface : colors.muted} />}
      <Txt weight="medium" style={{ fontSize: 12, color: active ? colors.surface : colors.ink }}>
        {label}
      </Txt>
    </Pressable>
  );
}
export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const { colors } = useApp();
  return (
    <View style={{ gap: 8 }}>
      {label && (
        <Txt weight="bold" style={{ fontSize: 12 }}>
          {label}
        </Txt>
      )}
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={colors.muted}
        style={[
          {
            fontFamily: tokens.font.body,
            color: colors.ink,
            backgroundColor: colors.raised,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 14,
            minHeight: 48,
            borderWidth: 1,
            borderColor: colors.line,
          },
          style,
        ]}
      />
    </View>
  );
}
export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const { colors } = useApp();
  return (
    <View style={{ padding: 32, alignItems: 'center', gap: 12 }}>
      <Icon name={icon} size={32} color={colors.muted} />
      <Txt weight="display" style={{ fontSize: 21, textAlign: 'center' }}>
        {title}
      </Txt>
      <Txt muted style={{ textAlign: 'center', lineHeight: 21 }}>
        {body}
      </Txt>
    </View>
  );
}
export const ui = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stack: { gap: 16 },
  divider: { height: 1, marginVertical: 16 },
  grow: { flex: 1 },
  label: { fontSize: 10, letterSpacing: 1.7, textTransform: 'uppercase' } as TextStyle,
});
