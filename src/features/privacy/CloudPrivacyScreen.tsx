import { useState } from 'react';
import { View, Switch, Linking } from 'react-native';
import { Button, Chip, Txt, ui } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useApp } from '../../state/AppContext';
import { useLiveLocation } from '../location/LiveLocation';
import { useMotion } from '../location/store';
import { motionLabel } from '../location/motion';
import type { Navigate } from '../../navigation/routes';
export function CloudPrivacyScreen({ navigate }: { navigate: Navigate }) {
  const { state, dispatch, colors, signedIn } = useApp();
  const live = useLiveLocation();
  const sample = useMotion(state.currentUserId);
  const [busy, setBusy] = useState(false);
  const value = {
    visibility:
      state.discovery.mode === 'public'
        ? ('public' as const)
        : state.discovery.mode === 'friends'
          ? ('friends' as const)
          : ('private' as const),
    precision:
      state.privacy.mode === 'approximate' ? ('approximate' as const) : ('precise' as const),
    showSpeed: state.privacy.showSpeed ?? false,
    showHeading: state.privacy.showHeading ?? false,
  };
  const change = async (next: Partial<typeof value>) => {
    if (next.visibility === 'private') live.stop();
    if (busy && next.visibility !== 'private') return;
    setBusy(true);
    try {
      await dispatch({ type: 'sharing', value: { ...value, ...next } });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      title="Your space, your rules"
      subtitle="Your location starts private."
      onClose={() => navigate({ name: 'map' })}
      back={() => navigate({ name: 'profile' })}
    >
      {!signedIn ? (
        <Button onPress={() => navigate({ name: 'account' })}>Sign in to manage sharing</Button>
      ) : (
        <>
          <Txt muted>
            Choose who may see your location, then enable device location below. Sharing runs only
            while Zuno is open. Blocks override every audience.
          </Txt>
          <View style={[ui.row, { gap: 8, flexWrap: 'wrap' }]}>
            {(['private', 'friends', 'public'] as const).map((visibility) => (
              <Chip
                key={visibility}
                label={
                  visibility === 'private'
                    ? 'Private'
                    : visibility === 'friends'
                      ? 'Friends only'
                      : 'Public'
                }
                active={value.visibility === visibility}
                onPress={() => void change({ visibility })}
              />
            ))}
          </View>
          <Txt muted>
            {value.visibility === 'public'
              ? 'Public sharing lets signed-in people browsing near you see your chosen location precision and motion settings.'
              : value.visibility === 'friends'
                ? 'Only accepted, unblocked friends can see you nearby.'
                : 'No one else can query or receive your location.'}
          </Txt>
          <Txt weight="bold">Location precision</Txt>
          <View style={[ui.row, { gap: 8 }]}>
            {(['approximate', 'precise'] as const).map((precision) => (
              <Chip
                key={precision}
                label={precision === 'precise' ? 'Exact location' : 'Neighborhood'}
                active={value.precision === precision}
                onPress={() => void change({ precision })}
              />
            ))}
          </View>
          <Txt muted>
            Neighborhood sharing uses a fixed area of about 2 km and hides speed and heading.
          </Txt>
          {(['showSpeed', 'showHeading'] as const).map((key) => (
            <View key={key} style={ui.between}>
              <Txt>{key === 'showSpeed' ? 'Share speed' : 'Share heading'}</Txt>
              <Switch
                accessibilityLabel={key === 'showSpeed' ? 'Share speed' : 'Share heading'}
                value={value[key]}
                disabled={busy || value.precision === 'approximate'}
                trackColor={{ true: colors.accent }}
                onValueChange={(checked) => {
                  void change({ [key]: checked });
                }}
              />
            </View>
          ))}
          <Button
            kind="secondary"
            disabled={busy || live.busy}
            onPress={() => (live.enabled ? live.stop() : void live.start())}
          >
            {live.busy
              ? 'Checking permission…'
              : live.enabled
                ? 'Stop device location'
                : 'Use location while here'}
          </Button>
          <Txt muted>
            {value.visibility === 'private'
              ? 'Your position is for you only.'
              : 'Enabling location also shares it with the audience selected above.'}{' '}
            Location pauses in the background and must be enabled again after signing in.
          </Txt>
          {live.enabled && (
            <Txt muted>
              {live.reducedAccuracy
                ? 'Precise Location is off. Movement sharing is paused; you can still browse.'
                : motionLabel(sample, state.discovery.units ?? 'mph')}
            </Txt>
          )}
          {!!live.error && <Txt accessibilityRole="alert">{live.error}</Txt>}
          {(live.error || live.reducedAccuracy) && (
            <Button kind="quiet" onPress={() => void Linking.openSettings()}>
              Open location settings
            </Button>
          )}
          <View style={[ui.row, { gap: 8 }]}>
            {(['mph', 'kmh'] as const).map((units) => (
              <Chip
                key={units}
                label={units === 'mph' ? 'Miles / mph' : 'Kilometers / km/h'}
                active={state.discovery.units === units}
                onPress={() => {
                  void dispatch({ type: 'discovery', value: { units } });
                }}
              />
            ))}
          </View>
          {state.blocks.length > 0 && <Txt weight="bold">Blocked accounts</Txt>}
          {state.blocks
            .filter((b) => b.blockerId === state.currentUserId)
            .map((b) => (
              <View key={b.blockedId} style={ui.between}>
                <Txt muted>Account · {b.blockedId.slice(0, 8)}</Txt>
                <Button
                  kind="quiet"
                  onPress={() => {
                    void dispatch({
                      type: 'friend',
                      id: b.blockedId,
                      operation: 'unblock',
                      now: new Date().toISOString(),
                    });
                  }}
                >
                  Unblock
                </Button>
              </View>
            ))}
        </>
      )}
    </Sheet>
  );
}
