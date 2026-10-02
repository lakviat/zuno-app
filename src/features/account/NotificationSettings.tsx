import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Txt } from '../../components/ui';
// No push sender/token registry exists yet. Do not ask for permission we cannot use.
export const pushDeliveryReady = false;
const preferenceKey = 'zuno.notifications.explanation.v1';
export function NotificationSettings({ contextual = false }: { contextual?: boolean }) {
  const [permission, setPermission] = useState<Notifications.NotificationPermissionsStatus | null>(
      null,
    ),
    [dismissed, setDismissed] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const read = () =>
      void Notifications.getPermissionsAsync()
        .then(setPermission)
        .catch(() => undefined);
    read();
    void AsyncStorage.getItem(preferenceKey)
      .then((value) => setDismissed(value === 'later'))
      .catch(() => undefined);
    const listener = AppState.addEventListener('change', (s) => {
      if (s === 'active') read();
    });
    return () => listener.remove();
  }, []);
  if (contextual && (!pushDeliveryReady || dismissed || permission?.status !== 'undetermined'))
    return null;
  const request = async () => {
    if (busy || !pushDeliveryReady) return;
    setBusy(true);
    setError('');
    try {
      setPermission(
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        }),
      );
    } catch {
      setError('Notification settings couldn’t be updated. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <Txt weight="bold">{contextual ? 'Stay in the loop' : 'Notifications'}</Txt>
      {!pushDeliveryReady ? (
        <Txt muted>
          Push notifications aren’t available in this beta yet. Messages and meetup updates appear
          while Zuno is open.
        </Txt>
      ) : (
        <>
          <Txt muted>
            {permission?.granted
              ? 'Notifications are allowed on this iPhone.'
              : permission?.status === 'denied'
                ? 'Notifications are off. You can change this in iPhone Settings.'
                : 'Get notified about messages, friend requests and changes to your meetups.'}
          </Txt>
          {permission?.canAskAgain === false ? (
            <Button kind="quiet" onPress={() => void Linking.openSettings()}>
              Open notification settings
            </Button>
          ) : (
            !permission?.granted && (
              <Button disabled={busy} onPress={() => void request()}>
                {busy ? 'Updating…' : 'Enable notifications'}
              </Button>
            )
          )}
          {contextual && (
            <Button
              kind="quiet"
              onPress={() => {
                setDismissed(true);
                void AsyncStorage.setItem(preferenceKey, 'later');
              }}
            >
              Not now
            </Button>
          )}
        </>
      )}
      {!!error && <Txt accessibilityRole="alert">{error}</Txt>}
    </View>
  );
}
