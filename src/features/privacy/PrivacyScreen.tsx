import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Button, Chip, Icon, Txt, ui, type IconName } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useApp } from '../../state/AppContext';
import { useLiveLocation } from '../location/LiveLocation';
import { useMotion } from '../location/store';
import { motionLabel } from '../location/motion';
import type { LocationPrecision } from '../../types/domain';
import type { Navigate } from '../../navigation/routes';

export function PrivacyScreen({ navigate }: { navigate: Navigate }) {
  const { now, state, friends, dispatch, colors, notify } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const live = useLiveLocation();
  const sample = useMotion(state.currentUserId);
  const privacy = state.privacy;
  const modes: { mode: LocationPrecision; title: string; body: string; icon: IconName }[] = [
    {
      mode: 'hidden',
      title: 'Just for you',
      body: 'Your location stays private. Your status can still be visible.',
      icon: 'eye-off',
    },
    {
      mode: 'approximate',
      title: 'In the neighborhood',
      body: 'Friends see an area about 2 km wide, never your exact spot.',
      icon: 'circle',
    },
    {
      mode: 'precise',
      title: 'Right here',
      body: 'Allow accepted friends to see your exact spot.',
      icon: 'map-pin',
    },
  ];
  const blocked = state.people.filter((p) =>
    state.blocks.some((b) => b.blockerId === state.currentUserId && b.blockedId === p.user.id),
  );
  return (
    <Sheet
      title="Your space, your rules"
      subtitle="Being close should always feel comfortable."
      onClose={() => navigate({ name: 'map' })}
      back={() => navigate({ name: 'profile' })}
    >
      <View style={{ padding: 18, backgroundColor: colors.greenSoft, borderRadius: 20, gap: 9 }}>
        <View style={[ui.row, { gap: 8 }]}>
          <Icon name="shield" color={colors.green} size={18} />
          <Txt weight="bold" style={{ color: colors.green }}>
            You’re in control
          </Txt>
        </View>
        <Txt style={{ fontSize: 12, lineHeight: 19, color: colors.green }}>
          This is a demo. No real location is shared. These choices preview how sharing will work
          with your friends.
        </Txt>
      </View>
      <View style={[ui.between, { padding: 18, borderRadius: 20, backgroundColor: colors.raised }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <Txt weight="display" style={{ fontSize: 21 }}>
            Ghost mode
          </Txt>
          <Txt muted style={{ fontSize: 12 }}>
            Pause sharing. Cancel temporary access.
          </Txt>
        </View>
        <Switch
          accessibilityLabel="Ghost mode"
          value={privacy.ghostMode}
          onValueChange={(value) =>
            dispatch({ type: 'privacy', value: { ...privacy, ghostMode: value } })
          }
          trackColor={{ true: colors.accent, false: colors.line }}
        />
      </View>
      <Txt weight="bold">Appear on the map</Txt>
      <View style={[ui.row, { gap: 8, flexWrap: 'wrap' }]}>
        {(['public', 'friends', 'hidden'] as const).map((mode) => (
          <Chip
            key={mode}
            label={
              mode === 'public'
                ? 'Public discovery'
                : mode === 'friends'
                  ? 'Friends only'
                  : 'Hidden'
            }
            active={(state.discovery.mode ?? 'friends') === mode}
            onPress={() =>
              dispatch({ type: 'discovery', value: { mode, optedIn: mode === 'public' } })
            }
          />
        ))}
      </View>
      <Txt muted style={{ fontSize: 12, lineHeight: 19 }}>
        Public discovery shows only an approximate neighborhood to non-friends. Exact friend sharing
        is a separate choice below. Ghost mode overrides both.
      </Txt>
      <Txt weight="bold">Who gets to see where you are?</Txt>
      {modes.map((m) => (
        <Pressable
          key={m.mode}
          accessibilityRole="radio"
          aria-checked={privacy.mode === m.mode}
          accessibilityLabel={m.title}
          accessibilityState={{ checked: privacy.mode === m.mode, disabled: privacy.ghostMode }}
          disabled={privacy.ghostMode}
          onPress={() =>
            dispatch({ type: 'privacy', value: { ...privacy, mode: m.mode, temporary: undefined } })
          }
          style={[
            ui.row,
            {
              gap: 14,
              borderWidth: 1,
              borderColor: privacy.mode === m.mode ? colors.accent : colors.line,
              borderRadius: 18,
              padding: 16,
              opacity: privacy.ghostMode ? 0.4 : 1,
            },
          ]}
        >
          <Icon name={m.icon} color={privacy.mode === m.mode ? colors.accent : colors.muted} />
          <View style={{ flex: 1, gap: 5 }}>
            <Txt weight="bold">{m.title}</Txt>
            <Txt muted style={{ fontSize: 12, lineHeight: 18 }}>
              {m.body}
            </Txt>
          </View>
          {privacy.mode === m.mode && <Icon name="check" color={colors.accent} size={18} />}
        </Pressable>
      ))}
      <Txt weight="bold">Just for a little while</Txt>
      <Txt muted style={{ fontSize: 12, lineHeight: 19 }}>
        Give selected friends precise access for one hour. Ghost mode overrides every sharing
        choice.
      </Txt>
      <View style={[ui.row, { gap: 7, flexWrap: 'wrap' }]}>
        {friends.map((f) => (
          <Chip
            key={f.user.id}
            label={f.profile.displayName.split(' ')[0]}
            active={selected.includes(f.user.id)}
            onPress={() =>
              setSelected((s) =>
                s.includes(f.user.id) ? s.filter((id) => id !== f.user.id) : [...s, f.user.id],
              )
            }
          />
        ))}
      </View>
      <Button
        kind="secondary"
        icon="clock"
        disabled={!selected.length || privacy.ghostMode}
        onPress={() => {
          dispatch({
            type: 'privacy',
            value: {
              ...privacy,
              temporary: {
                friendIds: selected,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
            },
          });
          notify('One-hour sharing preference saved for the demo.');
        }}
      >
        Share for one hour
      </Button>
      {privacy.temporary && Date.parse(privacy.temporary.expiresAt) > now && (
        <Button
          kind="quiet"
          onPress={() => dispatch({ type: 'privacy', value: { ...privacy, temporary: undefined } })}
        >
          Stop temporary sharing
        </Button>
      )}
      <View style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 20, gap: 10 }}>
        <Txt weight="bold">Device location</Txt>
        <Txt muted style={{ fontSize: 12, lineHeight: 19 }}>
          Optional foreground permission. We request it only when you tap below. Nothing is uploaded
          or broadcast.
        </Txt>
        <Button
          disabled={live.busy}
          kind="secondary"
          icon="navigation"
          onPress={() => (live.enabled ? live.stop() : void live.start())}
        >
          {live.busy
            ? 'Checking permission…'
            : live.enabled
              ? 'Stop device location'
              : 'Use location while here'}
        </Button>
        {live.enabled && (
          <Txt muted>
            {sample
              ? motionLabel(sample, state.discovery.units ?? 'mph')
              : 'Waiting for an accurate GPS sample…'}{' '}
            · On this device only
          </Txt>
        )}
        {!!live.error && <Txt accessibilityRole="alert">{live.error}</Txt>}
        <Txt muted style={{ fontSize: 12 }}>
          Zuno uses location while open to show your movement and nearby distances. Tracking pauses
          in the background. No background permission is requested.
        </Txt>
        <View style={[ui.row, { gap: 8 }]}>
          {(['mph', 'kmh'] as const).map((units) => (
            <Chip
              key={units}
              label={units === 'mph' ? 'Miles / mph' : 'Kilometers / km/h'}
              active={(state.discovery.units ?? 'mph') === units}
              onPress={() => dispatch({ type: 'discovery', value: { units } })}
            />
          ))}
        </View>
        {__DEV__ && (
          <Button kind="quiet" onPress={live.toggleMock}>
            {live.mock ? 'Stop simulated movement' : 'Preview simulated movement (development)'}
          </Button>
        )}
      </View>
      {blocked.length > 0 && (
        <>
          <Txt weight="bold">Blocked people</Txt>
          {blocked.map((p) => (
            <View key={p.user.id} style={ui.between}>
              <Txt>{p.profile.displayName}</Txt>
              <Button
                kind="quiet"
                onPress={() =>
                  dispatch({
                    type: 'friend',
                    id: p.user.id,
                    operation: 'unblock',
                    now: new Date().toISOString(),
                  })
                }
              >
                Unblock
              </Button>
            </View>
          ))}
        </>
      )}
      <Txt muted style={{ fontSize: 11, lineHeight: 18 }}>
        Sharing returns to hidden each time you reopen this prototype. Real sharing will require
        backend privacy enforcement in a later milestone.
      </Txt>
    </Sheet>
  );
}
