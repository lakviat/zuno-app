import { backendDiagnostic } from './diagnostics';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { AppSnapshot, Person, LocationPrivacy } from '../types/domain';
import type { Action } from '../state/reducer';
import type { MeetupCommand } from '../features/meetups/domain';
import type { LocationSample } from '../features/location/motion';
import { meetupPlaces } from '../features/meetups/places';
import { motionStore } from '../features/location/store';
import { distanceMeters, validCoordinate, type MapViewport } from '../utils/geo';
export interface SharedLocation extends LocationSample {
  userId: string;
  precision: 'precise' | 'approximate';
}
export type CloudSnapshot = AppSnapshot & {
  locations: SharedLocation[];
  blockedPeople: { id: string; label: string }[];
};
export function emptyCloud(userId = 'signed-out'): AppSnapshot {
  const now = new Date().toISOString();
  return {
    version: 2,
    dataMode: 'cloud',
    currentUserId: userId,
    people: [
      {
        user: { id: userId, createdAt: now },
        profile: {
          userId,
          displayName: 'Your account',
          username: '',
          bio: '',
          avatar: '',
          color: '#FF6857',
        },
        presence: {
          userId,
          kind: 'invisible',
          status: '',
          emoji: '☀️',
          updatedAt: now,
          freeNow: false,
        },
      },
    ],
    friendships: [],
    conversations: [],
    messages: [],
    meetups: [],
    blocks: [],
    reports: [],
    notifications: [],
    theme: 'system',
    privacy: { mode: 'hidden', ghostMode: true, showSpeed: false, showHeading: false },
    discovery: { optedIn: false, mode: 'hidden', interests: [], units: 'mph' },
  };
}
export function validSharedLocation(value: unknown): value is SharedLocation {
  if (!value || typeof value !== 'object') return false;
  const v = value as SharedLocation;
  return (
    typeof v.userId === 'string' &&
    !!v.coordinate &&
    validCoordinate(v.coordinate) &&
    Number.isFinite(v.timestamp) &&
    v.timestamp <= Date.now() + 10000 &&
    v.timestamp > Date.now() - 90000 &&
    Number.isFinite(v.accuracy) &&
    v.accuracy >= 0 &&
    (v.precision === 'precise' || v.precision === 'approximate') &&
    (v.speed === null || (Number.isFinite(v.speed) && v.speed >= 0 && v.speed <= 70)) &&
    (v.heading === null || (Number.isFinite(v.heading) && v.heading >= 0 && v.heading < 360))
  );
}
export function withCloudLocations(state: AppSnapshot, locations: SharedLocation[]): AppSnapshot {
  return {
    ...state,
    dataMode: 'cloud',
    people: state.people.map((p) => {
      const fix = locations.find((l) => l.userId === p.user.id && validSharedLocation(l));
      const friend = state.friendships.some(
        (f) => f.status === 'accepted' && [f.requesterId, f.addresseeId].includes(p.user.id),
      );
      if (fix && fix.precision === 'precise') motionStore.set(p.user.id, fix);
      else if (p.user.id !== state.currentUserId) motionStore.set(p.user.id);
      return {
        ...p,
        location: fix
          ? {
              userId: p.user.id,
              coordinate: fix.coordinate,
              accuracyMeters: fix.accuracy,
              updatedAt: new Date(fix.timestamp).toISOString(),
              place: fix.precision === 'precise' ? 'Shared location' : 'Approximate neighborhood',
              precision: fix.precision,
            }
          : undefined,
        mapAudience: friend ? 'friend' : 'public',
      };
    }),
  };
}
export function cloudError(error: unknown) {
  const message =
    error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  const allowed = [
    'Person unavailable',
    'Request unavailable',
    'Meetup unavailable',
    'Meetup has ended',
    'Meetup is full',
    'Only the host can change this meetup',
    'Hosts cancel instead of leaving',
    'Capacity is below the attendee count',
    'Keep existing participants in the audience',
    'Invite only accepted, unblocked friends',
    'Choose a future start time',
    'Choose a future end time',
    'Choose a valid meeting place',
    'Add this person as a friend to chat',
    'Only current members can send to an active meetup',
  ];
  if (allowed.includes(message)) return message + '.';
  if (message.includes('zuno_profiles_username')) return 'That username is taken. Choose another.';
  return 'Could not save or refresh. Check your connection and try again.';
}
/** Durable state and transport are separate; only the server determines recipients. */
export interface LocationTransport {
  publish(sample: LocationSample): Promise<void>;
  clear(): Promise<void>;
}
export class SupabaseSocial implements LocationTransport {
  private channel?: RealtimeChannel;
  private stopped = false;
  private requests = new AbortController();
  private locationQueue: Promise<unknown> = Promise.resolve();
  private locationGeneration = 0;
  private liveTimer: ReturnType<typeof setTimeout> | undefined;
  private fetchingLive = false;
  constructor(
    readonly client: SupabaseClient,
    readonly userId: string,
  ) {}
  async call<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> {
    if (this.stopped) throw new Error('Session ended');
    const {
      data: { session },
    } = await this.client.auth.getSession();
    if (this.stopped || session?.user.id !== this.userId) throw new Error('Session ended');
    // Pin this request to its originating account even if another sign-in occurs while fetching.
    const { data, error } = await this.client
      .rpc(name, args)
      .abortSignal(this.requests.signal)
      .setHeader('Authorization', `Bearer ${session.access_token}`);
    if (error) throw error;
    return data as T;
  }
  async bootstrap() {
    await this.call('zuno_bootstrap');
  }
  async watch(view: MapViewport) {
    const radius = Math.min(
      50000,
      Math.max(
        100,
        distanceMeters(view, {
          latitude: Math.min(90, view.latitude + Math.min(view.latitudeDelta, 170) / 2),
          longitude: ((view.longitude + Math.min(view.longitudeDelta, 360) / 2 + 540) % 360) - 180,
        }),
      ),
    );
    await this.call('zuno_watch_map', {
      lat: view.latitude,
      lng: view.longitude,
      radius_m: radius,
    });
  }
  async snapshot() {
    const snapshot = await this.call<CloudSnapshot>('zuno_social_snapshot');
    snapshot.meetups = snapshot.meetups.map((m) => ({ ...m, capacity: m.capacity ?? undefined }));
    return snapshot;
  }
  async search(query: string) {
    return this.call<Person[]>('zuno_search_people', { query });
  }
  async subscribe(
    onSync: () => void,
    onLocation: (value: SharedLocation) => void,
    onRemove: (id: string) => void,
    onStatus: (connected: boolean) => void,
  ) {
    backendDiagnostic('realtime-connecting');
    await this.client.realtime.setAuth();
    if (this.stopped) return;
    this.channel = this.client
      .channel(`zuno:user:${this.userId}`, { config: { private: true } })
      .on('broadcast', { event: 'sync' }, onSync)
      .on('broadcast', { event: 'location' }, () => {
        if (this.liveTimer || this.fetchingLive || this.stopped) return;
        this.liveTimer = setTimeout(() => {
          this.liveTimer = undefined;
          this.fetchingLive = true;
          void this.call<SharedLocation[]>('zuno_live_updates')
            .then((fixes) => {
              if (!this.stopped) fixes.filter(validSharedLocation).forEach(onLocation);
            })
            .catch(onSync)
            .finally(() => {
              this.fetchingLive = false;
            });
        }, 500);
      })
      .on('broadcast', { event: 'location_removed' }, ({ payload }) => {
        if (typeof payload?.userId === 'string') onRemove(payload.userId);
      })
      .subscribe((status) => {
        backendDiagnostic(status === 'SUBSCRIBED' ? 'realtime-connected' : 'realtime-disconnected');
        onStatus(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') onSync();
      });
  }
  close() {
    backendDiagnostic('realtime-closed');
    this.stopped = true;
    this.locationGeneration++;
    this.requests.abort();
    clearTimeout(this.liveTimer);
    if (this.channel) void this.client.removeChannel(this.channel);
  }
  async publish(sample: LocationSample) {
    const generation = this.locationGeneration;
    const send = async () => {
      if (generation !== this.locationGeneration || this.stopped) return;
      try {
        const accepted = await this.call<boolean>('zuno_publish_location', {
          lat: sample.coordinate.latitude,
          lng: sample.coordinate.longitude,
          speed_mps: sample.speed,
          heading: sample.heading,
          accuracy: sample.accuracy,
          sampled_at: new Date(sample.timestamp).toISOString(),
        });
        if (accepted) backendDiagnostic('location-published');
      } catch (error) {
        backendDiagnostic('location-publish-failed');
        throw error;
      }
    };
    const next = this.locationQueue.then(send, send);
    this.locationQueue = next;
    await next;
  }
  async clear() {
    this.locationGeneration++;
    const clear = async () => {
      if (!this.stopped) {
        try {
          await this.call('zuno_stop_location');
          backendDiagnostic('location-cleared');
        } catch (error) {
          backendDiagnostic('location-clear-failed');
          throw error;
        }
      }
    };
    const next = this.locationQueue.then(clear, clear);
    this.locationQueue = next;
    await next;
  }
  async privacy(privacy: LocationPrivacy, discovery: AppSnapshot['discovery']) {
    await this.call('zuno_set_privacy', {
      visibility:
        privacy.ghostMode || privacy.mode === 'hidden' || discovery.mode === 'hidden'
          ? 'private'
          : (discovery.mode ?? 'friends'),
      location_precision: privacy.mode === 'approximate' ? 'approximate' : 'precise',
      show_speed: privacy.showSpeed ?? false,
      show_heading: privacy.showHeading ?? false,
      units: discovery.units ?? 'mph',
    });
  }
  async action(action: Action, state: AppSnapshot) {
    switch (action.type) {
      case 'sharing':
        return this.call('zuno_set_privacy', {
          visibility: action.value.visibility,
          location_precision: action.value.precision,
          show_speed: action.value.showSpeed,
          show_heading: action.value.showHeading,
          units: state.discovery.units ?? 'mph',
        });
      case 'friend':
        return this.call('zuno_friend_action', { peer: action.id, operation: action.operation });
      case 'message':
        return this.call('zuno_send_message', {
          text: action.message.text,
          peer: action.friendId,
          client_id: uuidOrNull(action.message.id),
        });
      case 'meetup-message':
        return this.call('zuno_send_message', {
          text: action.text,
          event_id: action.meetupId,
          client_id: uuidOrNull(action.id),
        });
      case 'read':
        return this.call('zuno_mark_read', { conversation_id: action.conversationId });
      case 'report':
        return this.call('zuno_report', { subject_id: action.subjectId, reason: action.reason });
      case 'privacy':
        return this.privacy(action.value, state.discovery);
      case 'discovery':
        return this.privacy(state.privacy, { ...state.discovery, ...action.value });
      case 'profile':
      case 'availability': {
        const me = state.people.find((p) => p.user.id === state.currentUserId)!;
        const p = action.type === 'profile' ? { ...me.profile, ...action.value } : me.profile;
        return this.call('zuno_save_profile', {
          display_name: p.displayName,
          bio: p.bio,
          username: p.username,
          avatar_path: p.avatar || null,
          status: action.type === 'profile' ? action.status : me.presence.status,
          availability:
            action.type === 'availability' ? action.value : (me.presence.availability ?? 'busy'),
          intent: action.type === 'availability' ? action.intent : (me.presence.intent ?? ''),
        });
      }
    }
  }
  async meetup(command: MeetupCommand) {
    return this.call<string>('zuno_event_action', {
      operation: command.operation,
      event_id: uuidOrNull(command.id),
      ...('draft' in command
        ? {
            draft: {
              ...command.draft,
              place:
                command.draft.place ?? meetupPlaces.find((p) => p.id === command.draft.placeId),
            },
          }
        : {}),
    });
  }
}
function uuidOrNull(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
