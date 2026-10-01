import { View } from 'react-native';
import { Txt } from '../../components/ui';
import { useApp } from '../../state/AppContext';
export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  const { colors, dark } = useApp();
  return (
    <View style={{ gap: 8 }}>
      <Txt weight="bold" style={{ fontSize: 12 }}>
        {label}
      </Txt>
      <input
        type="datetime-local"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          minWidth: 0,
          minHeight: 48,
          padding: '12px 16px',
          borderRadius: 14,
          border: `1px solid ${colors.line}`,
          color: colors.ink,
          background: colors.raised,
          font: 'inherit',
          fontSize: 14,
          colorScheme: dark ? 'dark' : 'light',
        }}
      />
    </View>
  );
}
