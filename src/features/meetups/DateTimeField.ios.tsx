import DateTimePicker from '@react-native-community/datetimepicker';
import { View } from 'react-native';
import { Txt } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { localDateTime, toInstant } from './localTime';

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
  const instant = toInstant(value);
  return (
    <View style={{ gap: 8 }}>
      <Txt weight="bold" style={{ fontSize: 12 }}>
        {label}
      </Txt>
      <View
        style={{
          minHeight: 52,
          justifyContent: 'center',
          padding: 8,
          borderRadius: 14,
          backgroundColor: colors.raised,
        }}
      >
        <DateTimePicker
          accessibilityLabel={`${label} date and time`}
          value={instant ? new Date(instant) : new Date()}
          mode="datetime"
          display="compact"
          themeVariant={dark ? 'dark' : 'light'}
          accentColor={colors.accent}
          onValueChange={(_, date) => onChange(localDateTime(date.getTime()))}
          style={{ alignSelf: 'flex-start' }}
        />
      </View>
    </View>
  );
}
