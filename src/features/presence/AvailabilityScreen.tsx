import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { Button, Chip, Field, Txt, ui } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import type { Navigate } from '../../navigation/routes';
import { isAvailable } from './domain';
import { activityOptions } from './presentation';
export function AvailabilityScreen({ navigate }: { navigate: Navigate }) {
  const { me, now, dispatch, notify } = useApp();
  const [value, setValue] = useState<'free' | 'later' | 'busy'>(
    isAvailable(me.presence, now) ? 'free' : (me.presence.availability ?? 'busy'),
  );
  const [intent, setIntent] = useState(me.presence.intent ?? '');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [error, setError] = useState('');
  return (
    <Sheet
      title="Up for something?"
      subtitle="A little signal to your people."
      onClose={() => {
        mounted.current = false;
        navigate({ name: 'map' });
      }}
      footer={
        <Button
          disabled={saving}
          onPress={async () => {
            if (pending.current) return;
            pending.current = true;
            setSaving(true);
            setError('');
            try {
              const saved = await dispatch({
                type: 'availability',
                value,
                intent,
                now: Date.now(),
              });
              if (!mounted.current) return;
              if (!saved) {
                setError('Your status wasn’t saved. Check your connection and try again.');
                return;
              }
              notify(value === 'free' ? 'Free for the next two hours.' : 'Availability updated.');
              navigate({ name: 'map' });
            } catch {
              if (mounted.current)
                setError('Your status wasn’t saved. Check your connection and try again.');
            } finally {
              pending.current = false;
              if (mounted.current) setSaving(false);
            }
          }}
        >
          {saving ? 'Saving…' : 'Set availability'}
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
          <Chip
            key={id}
            label={label}
            active={value === id}
            onPress={() => {
              if (!pending.current) setValue(id);
            }}
          />
        ))}
      </View>
      <Txt weight="bold">What sounds good?</Txt>
      <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
        {activityOptions.map((label) => (
          <Chip
            key={label}
            label={label}
            active={intent === label}
            onPress={() => {
              if (!pending.current) setIntent(label);
            }}
          />
        ))}
      </View>
      <Field
        editable={!saving}
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
      {!!error && <Txt accessibilityRole="alert">{error}</Txt>}
    </Sheet>
  );
}
