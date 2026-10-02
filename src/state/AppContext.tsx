import AsyncStorage from '@react-native-async-storage/async-storage';
import { onSessionEnd } from '../backend/sessionLifecycle';
import { localTestLoginEnabled } from '../backend/client';
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
import { AppState, useColorScheme } from 'react-native';
import { createSeed } from '../mocks/seed';
import { MockSocialRepository } from '../repositories/MockSocialRepository';
import type { SocialRepository } from '../repositories/SocialRepository';
import type { AppSnapshot, Person, Message } from '../types/domain';
import { palette } from '../theme/tokens';
import { isBlocked, isFriend } from '../utils/privacy';
import { executeMeetup, type MeetupCommand, type MeetupResult } from '../features/meetups/domain';
import { useAccount, supabase, backendConfig } from '../features/account/AccountProvider';
import {
  SupabaseSocial,
  emptyCloud,
  withCloudLocations,
  cloudError,
  type SharedLocation,
} from '../backend/social';
import { motionStore } from '../features/location/store';
import { reducer, type Action } from './reducer';
const defaultRepository =
  __DEV__ && localTestLoginEnabled
    ? new MockSocialRepository('zuno.local-test.data.v1', () => {
        const snapshot = createSeed();
        const me = snapshot.people.find((person) => person.user.id === snapshot.currentUserId)!;
        me.profile.displayName = 'Testing';
        me.profile.username = 'testing';
        me.profile.bio = 'Local sample account';
        return snapshot;
      })
    : new MockSocialRepository();
const initialViewport: MapViewport = {
  latitude: 25.79,
  longitude: -80.14,
  latitudeDelta: 0.06,
  longitudeDelta: 0.05,
};
function useAppState(repository: SocialRepository, userId?: string) {
  const cloud = backendConfig.status !== 'unconfigured' || !__DEV__;
  const [remote] = useState(() =>
    cloud && supabase && userId ? new SupabaseSocial(supabase, userId) : null,
  );
  const [state, setState] = useState(() => (cloud ? emptyCloud(userId) : createSeed()));
  const latest = useRef(state);
  const install = useCallback((next: AppSnapshot) => {
    latest.current = next;
    setState(next);
  }, []);
  const [ready, setReady] = useState(cloud && !userId);
  useEffect(() => {
    if (!cloud) return;
    let current = true;
    void AsyncStorage.getItem('zuno.device.preferences.v1')
      .then((raw) => {
        if (!current || !raw) return;
        try {
          const saved = JSON.parse(raw);
          install({
            ...latest.current,
            theme: ['system', 'light', 'dark'].includes(saved.theme) ? saved.theme : 'system',
            edgeZoomHintSeen: saved.edgeZoomHintSeen === true,
          });
        } catch {}
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [cloud, install]);
  const [toast, setToast] = useState('');
  const [syncError, setSyncError] = useState('');
  const [connected, setConnected] = useState(false);
  const alive = useRef(true);
  const locations = useRef(new Map<string, SharedLocation>());
  const searchPeople = useRef<Person[]>([]);
  const history = useRef<Message[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [meetupViewerId, setMeetupViewerId] = useState(userId ?? (cloud ? 'signed-out' : 'me'));
  const [meetupAreaId, setMeetupAreaId] = useState('sunset-harbour');
  const [meetupViewport, setMeetupViewport] = useState<MapViewport>();
  const view = useRef(initialViewport);
  const [now, setNow] = useState(Date.now);
  const refreshing = useRef<Promise<AppSnapshot> | null>(null);
  const refresh = useCallback(
    async (fresh = false): Promise<AppSnapshot> => {
      if (!remote) return latest.current;
      if (refreshing.current) {
        if (!fresh) return refreshing.current;
        try {
          await refreshing.current;
        } catch {}
      }
      const task = (async () => {
        const raw = await remote.snapshot();
        if (!alive.current) return latest.current;
        // Snapshot is authoritative for revocations. Never re-add a disappeared person from cached GPS.
        const next = new Map(raw.locations.map((l) => [l.userId, l]));
        for (const [id, fix] of locations.current) {
          const durable = next.get(id);
          if (durable && fix.timestamp > durable.timestamp) next.set(id, fix);
        }
        for (const id of locations.current.keys()) if (!next.has(id)) motionStore.set(id);
        locations.current = next;
        const people = [
          ...raw.people,
          ...searchPeople.current.filter(
            (p) =>
              !raw.people.some((v) => v.user.id === p.user.id) &&
              !raw.blocks.some((b) => b.blockedId === p.user.id),
          ),
        ];
        history.current = history.current.filter(
          (m) =>
            raw.conversations.some((c) => c.id === m.conversationId) &&
            raw.people.some((p) => p.user.id === m.senderId),
        );
        const messages = [
          ...history.current.filter((m) => !raw.messages.some((v) => v.id === m.id)),
          ...raw.messages,
        ].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
        const snapshot = withCloudLocations(
          {
            ...raw,
            people,
            messages,
            theme: latest.current.theme,
            edgeZoomHintSeen: latest.current.edgeZoomHintSeen,
          },
          [...next.values()],
        );
        install(snapshot);
        setSyncError('');
        setReady(true);
        return snapshot;
      })();
      refreshing.current = task;
      try {
        return await task;
      } finally {
        refreshing.current = null;
      }
    },
    [remote, install],
  );
  useEffect(() => {
    alive.current = true;
    if (!cloud) {
      void repository
        .load()
        .then((snapshot) => {
          if (alive.current) install(snapshot);
        })
        .catch(() => {
          if (alive.current) setToast('Could not read saved data. Starting a fresh demo.');
        })
        .finally(() => {
          if (alive.current) setReady(true);
        });
      return () => {
        alive.current = false;
      };
    }
    if (!remote)
      return () => {
        alive.current = false;
      };
    const revoke = onSessionEnd(() => {
      alive.current = false;
      remote.close();
      locations.current.clear();
      history.current = [];
      searchPeople.current = [];
      latest.current.people.forEach((p) => motionStore.set(p.user.id));
    });
    let active = AppState.currentState === 'active';
    let initialized = false;
    let starting = false;
    const sync = () => {
      if (active && alive.current)
        void refresh().catch(() => {
          if (alive.current) {
            setSyncError(
              'Connection interrupted. Your saved changes will return when you reconnect.',
            );
            setReady(true);
          }
        });
    };
    const start = async () => {
      if (starting || !active || !alive.current) return;
      starting = true;
      try {
        await remote.bootstrap();
        await remote.watch(view.current);
        await refresh();
        await remote.subscribe(
          sync,
          (fix) => {
            if (!alive.current || !active) return;
            const old = locations.current.get(fix.userId);
            if (old && old.timestamp >= fix.timestamp) return;
            locations.current.set(fix.userId, fix);
            if (latest.current.people.some((p) => p.user.id === fix.userId))
              install(withCloudLocations(latest.current, [...locations.current.values()]));
            else sync();
          },
          (id) => {
            locations.current.delete(id);
            motionStore.set(id);
            if (alive.current)
              install(withCloudLocations(latest.current, [...locations.current.values()]));
            sync();
          },
          (value) => {
            if (alive.current) setConnected(value);
          },
        );
        initialized = true;
      } catch {
        initialized = false;
        if (alive.current) {
          setSyncError('Could not connect to Zuno. Check your connection and retry.');
          setReady(true);
        }
      } finally {
        starting = false;
      }
    };
    void start();
    const timer = setInterval(() => {
      if (!active || !alive.current) return;
      if (!initialized) {
        void start();
        return;
      }
      void remote
        .watch(view.current)
        .then(sync)
        .catch(() => setSyncError('Reconnecting to Zuno…'));
    }, 15000);
    const lifecycle = AppState.addEventListener('change', (next) => {
      active = next === 'active';
      if (active) {
        if (initialized)
          void remote
            .watch(view.current)
            .then(sync)
            .catch(() => undefined);
        else void start();
      } else {
        void remote.clear().catch(() => undefined);
        locations.current.clear();
        latest.current.people.forEach((p) => motionStore.set(p.user.id));
        install(withCloudLocations(latest.current, []));
      }
    });
    return () => {
      alive.current = false;
      clearInterval(timer);
      lifecycle.remove();
      revoke();
      remote.close();
      latest.current.people.forEach((p) => motionStore.set(p.user.id));
    };
  }, [cloud, remote, repository, refresh, install]);
  useEffect(() => {
    if (!cloud && ready)
      void repository
        .save(state)
        .catch(() => setToast('Changes could not be saved on this device.'));
  }, [state, ready, cloud, repository]);
  useEffect(() => {
    if (!meetupViewport) return;
    view.current = meetupViewport;
    if (!remote) return;
    const timer = setTimeout(() => {
      void remote
        .watch(meetupViewport)
        .then(() => refresh())
        .catch(() => setSyncError('Could not refresh this map area.'));
    }, 500);
    return () => clearTimeout(timer);
  }, [meetupViewport, remote, refresh]);
  const dispatch = useCallback(
    (action: Action): Promise<boolean> => {
      if (
        !cloud ||
        action.type === 'theme' ||
        action.type === 'zoom-hint-seen' ||
        action.type === 'hydrate'
      ) {
        const next = reducer(latest.current, action);
        install(next);
        if (cloud && (action.type === 'theme' || action.type === 'zoom-hint-seen'))
          void AsyncStorage.setItem(
            'zuno.device.preferences.v1',
            JSON.stringify({ theme: next.theme, edgeZoomHintSeen: next.edgeZoomHintSeen }),
          ).catch(() => undefined);
        return Promise.resolve(true);
      }
      if (!remote) {
        setToast('Sign in to use your Zuno account.');
        return Promise.resolve(false);
      }
      const work = async () => {
        try {
          await remote.action(action, latest.current);
          if (!alive.current) return false;
          await refresh(true);
          return true;
        } catch (error) {
          if (alive.current) setToast(cloudError(error));
          return false;
        }
      };
      const next = queue.current.then(work, work);
      queue.current = next;
      return next;
    },
    [cloud, remote, install, refresh],
  );
  const runMeetup = useCallback(
    async (command: MeetupCommand): Promise<MeetupResult> => {
      if (!cloud) {
        const result = executeMeetup(latest.current, meetupViewerId, command);
        if (result.ok) {
          install(result.snapshot);
          setNow(Date.now());
        }
        return result;
      }
      if (!remote) return { ok: false, error: 'Sign in to create or join a meetup.' };
      try {
        const id = await remote.meetup(command);
        const snapshot = await refresh(true);
        const meetup = snapshot.meetups.find((m) => m.id === id);
        if (!meetup)
          return { ok: false, error: 'Saved. Reopen the meetup to refresh its details.' };
        return { ok: true, snapshot, meetup };
      } catch (error) {
        return { ok: false, error: cloudError(error) };
      }
    },
    [cloud, remote, meetupViewerId, install, refresh],
  );
  const loadOlder = useCallback(
    async (conversationId: string) => {
      if (!remote) return 0;
      const first = latest.current.messages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0];
      type Row = {
        id: string;
        conversation_id: string;
        sender_id: string;
        text: string;
        created_at: string;
      };
      try {
        const rows = await remote.call<Row[]>('zuno_message_history', {
          conversation_id: conversationId,
          ...(first ? { before_time: first.createdAt, before_id: first.id } : {}),
        });
        if (!alive.current) return 0;
        const fresh = await refresh(true);
        if (!fresh.conversations.some((c) => c.id === conversationId)) return 0;
        const older: Message[] = rows
          .filter((row) => fresh.people.some((p) => p.user.id === row.sender_id))
          .map((row) => ({
            id: row.id,
            conversationId: row.conversation_id,
            senderId: row.sender_id,
            text: row.text,
            createdAt: row.created_at,
            state: 'sent',
            kind: 'text',
          }));
        history.current = [
          ...history.current.filter((m) => !older.some((v) => v.id === m.id)),
          ...older,
        ];
        install({
          ...fresh,
          messages: [
            ...older.filter((m) => !fresh.messages.some((v) => v.id === m.id)),
            ...fresh.messages,
          ].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
        });
        return rows.length;
      } catch {
        setToast('Could not load older messages. Please try again.');
        return -1;
      }
    },
    [remote, refresh, install],
  );
  const search = useCallback(
    async (query: string) => {
      if (!remote) return;
      try {
        const people = await remote.search(query);
        if (!alive.current) return;
        searchPeople.current = people;
        install({
          ...latest.current,
          people: [
            ...latest.current.people,
            ...people.filter((p) => !latest.current.people.some((v) => v.user.id === p.user.id)),
          ],
        });
      } catch {
        setToast('Could not search. Check your connection.');
      }
    },
    [remote, install],
  );
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  const systemTheme = useColorScheme();
  const dark = state.theme === 'dark' || (state.theme === 'system' && systemTheme === 'dark');
  const friends = useMemo(
    () => state.people.filter((p) => isFriend(state, p.user.id) && !isBlocked(state, p.user.id)),
    [state],
  );
  const me =
    state.people.find((p) => p.user.id === state.currentUserId) ??
    emptyCloud(state.currentUserId).people[0];
  const reset = useCallback(async () => {
    if (cloud) return;
    await repository.clear();
    install(await repository.load());
    setToast('Your local demo has been reset.');
  }, [cloud, repository, install]);
  return {
    state,
    cloud,
    remote,
    signedIn: !!userId,
    connected,
    syncError,
    refresh,
    search,
    loadOlder,
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
function SessionAppProvider({
  children,
  repository,
  userId,
}: React.PropsWithChildren<{ repository: SocialRepository; userId?: string }>) {
  const value = useAppState(repository, userId);
  return (
    <AppContext.Provider value={value}>
      <ThemeContext.Provider value={value.colors}>{children}</ThemeContext.Provider>
    </AppContext.Provider>
  );
}
export function AppProvider({
  children,
  repository = defaultRepository,
}: React.PropsWithChildren<{ repository?: SocialRepository }>) {
  const { session } = useAccount();
  return (
    <SessionAppProvider
      key={session?.user.id ?? 'signed-out'}
      userId={session?.user.id}
      repository={repository}
    >
      {children}
    </SessionAppProvider>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider is required');
  return value;
}
