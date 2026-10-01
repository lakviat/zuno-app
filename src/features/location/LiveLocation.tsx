import {
  createContext,
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
  const { state } = useApp();
  const latest = useRef(state);
  useLayoutEffect(() => {
    latest.current = state;
  }, [state]);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reducedAccuracy, setReducedAccuracy] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [distance, setDistance] = useState(15);
  const [mock, setMock] = useState(false);
  const generation = useRef(0);
  const previous = useRef<LocationSample | undefined>(undefined);
  const publishedAt = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      motionStore.set(latest.current.currentUserId);
      void localLocationPublisher.clear();
    },
    [],
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setForeground(next === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    // Revoke the publisher's previous envelope as soon as any privacy/audience choice changes.
    void localLocationPublisher.clear();
  }, [state.privacy, state.discovery, state.friendships, state.blocks]);
  useEffect(() => {
    if (!enabled || !foreground) {
      motionStore.set(state.currentUserId);
      previous.current = undefined;
      publishedAt.current = 0;
      void localLocationPublisher.clear();
      return;
    }
    let alive = true;
    let watcher: { remove(): void } | undefined;
    void deviceLocation
      .watch(
        distance,
        (raw) => {
          if (!alive) return;
          const sample = filterSample(raw, previous.current);
          if (!sample) return;
          previous.current = sample;
          motionStore.set(latest.current.currentUserId, sample);
          const policy = updatePolicy(sample.speed);
          setDistance((old) => (old === policy.distance ? old : policy.distance));
          if (sample.timestamp - publishedAt.current >= policy.interval) {
            publishedAt.current = sample.timestamp;
            void localLocationPublisher
              .publish(publicationFor(latest.current, sample))
              .catch(() => setError('Sharing is temporarily unavailable.'));
          }
        },
        (message) => {
          if (alive) {
            setError(message);
            setEnabled(false);
          }
        },
        (accuracy) => {
          if (alive) setReducedAccuracy(accuracy === 'reduced');
        },
      )
      .then((sub) => {
        if (alive) watcher = sub;
        else sub.remove();
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
    };
  }, [enabled, foreground, distance, state.currentUserId]);
  useEffect(() => {
    if (!__DEV__ || !mock || !foreground) return;
    // Metro drops this development-only branch from Release builds.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Release removes this development-only branch.
    const { startMockMovement } = require('./mockMovement') as typeof import('./mockMovement');
    return startMockMovement();
  }, [mock, foreground]);
  const stop = () => {
    generation.current++;
    setEnabled(false);
    setBusy(false);
    motionStore.set(state.currentUserId);
    void localLocationPublisher.clear();
  };
  return (
    <LiveContext.Provider
      value={{
        enabled,
        busy,
        error,
        reducedAccuracy,
        mock,
        async start() {
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
