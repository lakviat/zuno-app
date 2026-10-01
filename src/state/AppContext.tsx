import type { MapViewport } from '../utils/geo';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { useColorScheme } from 'react-native';
import { createSeed } from '../mocks/seed';
import { MockSocialRepository } from '../repositories/MockSocialRepository';
import type { SocialRepository } from '../repositories/SocialRepository';
import { palette } from '../theme/tokens';
import { isBlocked, isFriend } from '../utils/privacy';
import { executeMeetup, type MeetupCommand } from '../features/meetups/domain';
import { reducer, type Action } from './reducer';

const defaultRepository = new MockSocialRepository();
function useAppState(repository: SocialRepository) {
  const [state, setState] = useState(createSeed);
  const latest = useRef(state);
  const dispatch = useCallback((action: Action) => {
    const next = reducer(latest.current, action);
    latest.current = next;
    setState(next);
  }, []);
  // This preview actor only affects meetups. It never impersonates a personal location session.
  const [meetupViewerId, setMeetupViewerId] = useState('me');
  const [meetupAreaId, setMeetupAreaId] = useState('sunset-harbour');
  const [meetupViewport, setMeetupViewport] = useState<MapViewport>();
  const [now, setNow] = useState(Date.now);
  const runMeetup = useCallback(
    (command: MeetupCommand) => {
      const result = executeMeetup(latest.current, meetupViewerId, command);
      if (result.ok) {
        latest.current = result.snapshot;
        setState(result.snapshot);
        setNow(Date.now());
      }
      return result;
    },
    [meetupViewerId],
  );
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState('');
  const systemTheme = useColorScheme();
  useEffect(() => {
    let alive = true;
    repository
      .load()
      .then((snapshot) => {
        if (alive) dispatch({ type: 'hydrate', snapshot });
      })
      .catch(() => {
        if (alive) setToast('Could not read saved data. Starting a fresh demo.');
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [repository, dispatch]);
  useEffect(() => {
    if (ready)
      repository.save(state).catch(() => setToast('Changes could not be saved on this device.'));
  }, [state, ready, repository]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(timeout);
  }, [toast]);
  const dark = state.theme === 'dark' || (state.theme === 'system' && systemTheme === 'dark');
  const friends = useMemo(
    () => state.people.filter((p) => isFriend(state, p.user.id) && !isBlocked(state, p.user.id)),
    [state],
  );
  const me = state.people.find((p) => p.user.id === state.currentUserId)!;
  const reset = useCallback(async () => {
    await repository.clear();
    dispatch({ type: 'hydrate', snapshot: createSeed() });
    setToast('Your local demo has been reset.');
  }, [repository, dispatch]);
  return {
    state,
    meetupViewerId,
    setMeetupViewerId,
    meetupAreaId,
    meetupViewport,
    setMeetupViewport,
    setMeetupAreaId,
    runMeetup,
    now,
    dispatch,
    ready,
    toast,
    notify: setToast,
    dark,
    colors: palette[dark ? 'dark' : 'light'],
    friends,
    me,
    reset,
  };
}
const ThemeContext = createContext(palette.light);
export function useTheme() {
  return { colors: useContext(ThemeContext) };
}
const AppContext = createContext<ReturnType<typeof useAppState> | null>(null);
export function AppProvider({
  children,
  repository = defaultRepository,
}: React.PropsWithChildren<{ repository?: SocialRepository }>) {
  const value = useAppState(repository);
  return (
    <AppContext.Provider value={value}>
      <ThemeContext.Provider value={value.colors}>{children}</ThemeContext.Provider>
    </AppContext.Provider>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider is required');
  return value;
}
