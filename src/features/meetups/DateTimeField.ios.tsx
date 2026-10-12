import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Pressable, View } from 'react-native';
import { Button, Icon, Txt, ui } from '../../components/ui';
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
  const [showTime, setShowTime] = useState(false);
  const instant = toInstant(value);
  const date = instant ? new Date(instant) : new Date();
  const change = (next: Date, part: 'date' | 'time') => {
    const combined = new Date(date);
    if (part === 'date') combined.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
    else combined.setHours(next.getHours(), next.getMinutes(), 0, 0);
    onChange(localDateTime(combined.getTime()));
  };
  return (
    <View style={{ gap: 8 }}>
      <Txt weight="bold" style={{ fontSize: 12 }}>
        {label}
      </Txt>
      <View style={{ padding: 8, borderRadius: 14, backgroundColor: colors.raised }}>
        <View style={[ui.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }]}>
          <DateTimePicker
            accessibilityLabel={`${label} date`}
            value={date}
            mode="date"
            display="compact"
            themeVariant={dark ? 'dark' : 'light'}
            accentColor={colors.accent}
            onValueChange={(_, next) => change(next, 'date')}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} time`}
            accessibilityState={{ expanded: showTime }}
            onPress={() => setShowTime((open) => !open)}
            style={[ui.row, { minHeight: 44, gap: 8, paddingHorizontal: 12 }]}
          >
            <Icon name="clock" size={16} color={colors.muted} />
            <Txt weight="medium">
              {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </Txt>
            <Icon name={showTime ? 'chevron-up' : 'chevron-down'} size={16} />
          </Pressable>
        </View>
        {showTime && (
          <>
            <DateTimePicker
              accessibilityLabel={`${label} time wheel`}
              value={date}
              mode="time"
              display="spinner"
              themeVariant={dark ? 'dark' : 'light'}
              textColor={colors.ink}
              onValueChange={(_, next) => change(next, 'time')}
              style={{ height: 180, width: '100%' }}
            />
            <Button
              kind="quiet"
              onPress={() => setShowTime(false)}
            >{`Done with ${label.toLowerCase()} time`}</Button>
          </>
        )}
      </View>
    </View>
  );
}
