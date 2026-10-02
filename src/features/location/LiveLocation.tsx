import * as ExpoLocation from 'expo-location';
import { useAccount } from '../account/AccountProvider';
import { onSessionEnd } from '../../backend/sessionLifecycle';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { useApp } from '../../state/AppContext';
import { deviceLocation } from '../../services/location';
import { localLocationPublisher, publicationFor } from '../../services/locationPublishing';
import { filterSample, updatePolicy, type LocationSample } from './motion';
import { motionStore } from './store';
const LiveContext = createContext<{
  enabled: boolean;
  busy: boolean;
  error: string;
  reducedAccuracy: boolean;
  start(): Promise<void>;
  stop(): void;
  mock: boolean;
  toggleMock(): void;
} | null>(null);
export function LiveLocationProvider({ children }: PropsWithChildren) {
  const { state, remote, cloud, signedIn } = useApp();
  const account = useAccount();
  const latest = useRef(state);
  useLayoutEffect(() => {
    latest.current = state;
  }, [state]);
  const clearSharing = useCallback(
    () => (remote ? remote.clear().catch(() => undefined) : localLocationPublisher.clear()),
    [remote],
  );
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reducedAccuracy, setReducedAccuracy] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [distance, setDistance] = useState(15);
  const [mock, setMock] = useState(false);
  const generation = useRef(0);
  const activeWatch = useRef<{ remove(): void } | undefined>(undefined);
  const previous = useRef<LocationSample | undefined>(undefined);
  const publishedAt = useRef(0);
  useEffect(() => {
    if (!account.locationEnabled || !signedIn) return;
    let alive = true;
    const token = generation.current;
    void ExpoLocation.getForegroundPermissionsAsync()
      .then((permission) => {
        if (alive && token === generation.current && permission.status === 'granted') {
          setReducedAccuracy(permission.ios?.accuracy === 'reduced');
          setEnabled(true);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [account.locationEnabled, signedIn]);
  useEffect(
    () => () => {
      generation.current++;
      motionStore.set(latest.current.currentUserId);
      void clearSharing();
    },
    [clearSharing],
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setForeground(next === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    publishedAt.current = 0;
    // Revoke the publisher's previous envelope as soon as any privacy/audience choice changes.
    void clearSharing();
  }, [state.privacy.mode, state.privacy.ghostMode, state.discovery.mode, clearSharing]);
  useEffect(() => {
    if (!enabled || !foreground) {
      motionStore.set(state.currentUserId);
      previous.current = undefined;
      publishedAt.current = 0;
      void clearSharing();
      return;
    }
    let alive = true;
    const watchGeneration = generation.current;
    let watcher: { remove(): void } | undefined;
    void deviceLocation
      .watch(
        distance,
        (raw) => {
          if (
            !alive ||
            watchGeneration !== generation.current ||
            AppState.currentState !== 'active'
          )
            return;
          const sample = filterSample(raw, previous.current);
          if (!sample) return;
          previous.current = sample;
          motionStore.set(latest.current.currentUserId, sample);
          const policy = cloud
            ? {
                interval: sample.speed !== null && sample.speed >= 1 ? 3000 : 60000,
                distance: sample.speed !== null && sample.speed >= 1 ? 5 : 25,
              }
            : updatePolicy(sample.speed);
          setDistance((old) => (old === policy.distance ? old : policy.distance));
          if (sample.timestamp - publishedAt.current >= policy.interval) {
            publishedAt.current = sample.timestamp;
            void (
              remote &&
              !latest.current.privacy.ghostMode &&
              latest.current.privacy.mode !== 'hidden' &&
              latest.current.discovery.mode !== 'hidden'
                ? remote.publish(sample)
                : localLocationPublisher.publish(publicationFor(latest.current, sample))
            ).catch(() => setError('Sharing is temporarily unavailable.'));
          }
        },
        (message) => {
          if (alive) {
            generation.current++;
            void clearSharing();
            setError(message);
            setEnabled(false);
          }
        },
        (accuracy) => {
          if (alive) {
            setReducedAccuracy(accuracy === 'reduced');
            if (accuracy === 'reduced') {
              motionStore.set(latest.current.currentUserId);
              void clearSharing();
            }
          }
        },
      )
      .then((sub) => {
        if (alive && watchGeneration === generation.current) {
          watcher = sub;
          activeWatch.current = sub;
        } else sub.remove();
      })
      .catch((e) => {
        if (alive) {
          setError(e instanceof Error ? e.message : 'Location unavailable.');
          setEnabled(false);
        }
      });
    return () => {
      alive = false;
      watcher?.remove();
      if (activeWatch.current === watcher) activeWatch.current = undefined;
    };
  }, [enabled, foreground, distance, state.currentUserId, cloud, remote, clearSharing]);
  useEffect(() => {
    if (cloud || !__DEV__ || !mock || !foreground) return;
    // Metro drops this development-only branch from Release builds.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Release removes this development-only branch.
    const { startMockMovement } = require('./mockMovement') as typeof import('./mockMovement');
    return startMockMovement();
  }, [mock, foreground, cloud]);
  const stop = () => {
    generation.current++;
    activeWatch.current?.remove();
    activeWatch.current = undefined;
    setEnabled(false);
    setBusy(false);
    motionStore.set(state.currentUserId);
    void clearSharing();
  };
  useEffect(
    () =>
      onSessionEnd(() => {
        generation.current++;
        activeWatch.current?.remove();
        activeWatch.current = undefined;
        setEnabled(false);
        setBusy(false);
        motionStore.set(latest.current.currentUserId);
      }),
    [],
  );
  return (
    <LiveContext.Provider
      value={{
        enabled,
        busy,
        error,
        reducedAccuracy,
        mock,
        async start() {
          if (cloud && !signedIn) {
            setError('Sign in before enabling device location.');
            return;
          }
          const token = ++generation.current;
          setBusy(true);
          setError('');
          try {
            const accuracy = await deviceLocation.requestPermission();
            if (token === generation.current) {
              setReducedAccuracy(accuracy === 'reduced');
              setEnabled(true);
            }
          } catch (e) {
            if (token === generation.current)
              setError(e instanceof Error ? e.message : 'Location unavailable.');
          } finally {
            if (token === generation.current) setBusy(false);
          }
        },
        stop,
        toggleMock: () => {
          if (__DEV__) setMock((v) => !v);
        },
      }}
    >
      {children}
    </LiveContext.Provider>
  );
}
export function useLiveLocation() {
  const value = useContext(LiveContext);
  if (!value) throw new Error('LiveLocationProvider required');
  return value;
}
