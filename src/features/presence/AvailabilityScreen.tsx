import { useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { Button, Chip, Field, Txt, ui } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import type { Navigate } from '../../navigation/routes';
import { isAvailable } from './domain';
export function AvailabilityScreen({ navigate }: { navigate: Navigate }) {
  const { me, now, dispatch, notify } = useApp();
  const [value, setValue] = useState<'free' | 'later' | 'busy'>(
    isAvailable(me.presence, now) ? 'free' : (me.presence.availability ?? 'busy'),
  );
  const [intent, setIntent] = useState(me.presence.intent ?? '');
  return (
    <Sheet
      title="Up for something?"
      subtitle="A little signal to your people."
      onClose={() => navigate({ name: 'map' })}
      footer={
        <Button
          onPress={() => {
            dispatch({ type: 'availability', value, intent, now: Date.now() });
            notify(value === 'free' ? 'Free for the next two hours.' : 'Availability updated.');
            navigate({ name: 'map' });
          }}
        >
          Set availability
        </Button>
      }
    >
      <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
        {(
          [
            ['free', 'Free now'],
            ['later', 'Maybe later'],
            ['busy', 'Busy'],
          ] as const
        ).map(([id, label]) => (
          <Chip key={id} label={label} active={value === id} onPress={() => setValue(id)} />
        ))}
      </View>
      <Txt weight="bold">What sounds good?</Txt>
      <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
        {['☕ Coffee', '🏖 Beach', '🍸 Drinks', '🏋️ Gym', '💬 Hang out'].map((label) => (
          <Chip
            key={label}
            label={label}
            active={intent === label}
            onPress={() => setIntent(label)}
          />
        ))}
      </View>
      <Field
        label="Your idea (optional)"
        value={intent}
        onChangeText={setIntent}
        placeholder="Anyone want sushi?"
        maxLength={60}
      />
      <Txt muted>
        Free now expires after two hours. This changes your availability, never who can see your
        location.
      </Txt>
    </Sheet>
  );
}
