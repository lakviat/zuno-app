import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseSocial, emptyCloud, validSharedLocation, withCloudLocations } from './social';
import { discoverablePeople } from '../features/presence/domain';
import { motionLabel } from '../features/location/motion';
function scopedClient(
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>,
  id: string,
) {
  return {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id }, access_token: 'local-test-placeholder' } },
      }),
    },
    rpc: (name: string, args?: Record<string, unknown>) => ({
      abortSignal: () => ({ setHeader: () => rpc(name, args) }),
    }),
  } as unknown as SupabaseClient;
}

const user = '10000000-0000-0000-0000-000000000001';
const peer = '20000000-0000-0000-0000-000000000002';
const sample = {
  coordinate: { latitude: 25.79, longitude: -80.14 },
  timestamp: Date.now(),
  accuracy: 8,
  speed: 11.176,
  heading: 90,
};
describe('cloud state and location transport', () => {
  it('does not seed people, meetups or messages for a real account', () => {
    const state = emptyCloud(user);
    expect(state.people.map((p) => p.user.id)).toEqual([user]);
    expect(state.meetups).toEqual([]);
    expect(state.messages).toEqual([]);
    expect(state.privacy.mode).toBe('hidden');
  });
  it('shows authorized public exact motion without applying demo approximation', () => {
    const state = emptyCloud(user);
    state.people.push({ ...emptyCloud(peer).people[0] });
    const fix = { ...sample, userId: peer, precision: 'precise' as const };
    const mapped = withCloudLocations(state, [fix]);
    expect(discoverablePeople(mapped, Date.now())[0].location?.coordinate).toEqual(
      sample.coordinate,
    );
    expect(motionLabel(fix)).toContain('25 mph');
    expect(discoverablePeople(mapped, Date.now() + 91000)).toEqual([]);
  });
  it('rejects stale, malformed and impossible incoming positions', () => {
    const fix = { ...sample, userId: peer, precision: 'precise' };
    expect(validSharedLocation(fix)).toBe(true);
    for (const invalid of [
      { ...fix, timestamp: Date.now() - 100000 },
      { ...fix, speed: -1 },
      { ...fix, heading: 360 },
      { ...fix, coordinate: { latitude: 91, longitude: 0 } },
      { ...fix, precision: 'unknown' },
    ])
      expect(validSharedLocation(invalid)).toBe(false);
  });
  it('stop invalidates pending publications and clears after any in-flight write', async () => {
    let finish: () => void = () => {};
    const first = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const calls: string[] = [];
    const rpc = vi.fn(async (name: string) => {
      calls.push(name);
      if (name === 'zuno_publish_location') await first;
      return { data: true, error: null };
    });
    const remote = new SupabaseSocial(scopedClient(rpc, user), user);
    const sent = remote.publish(sample);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const queued = remote.publish({ ...sample, timestamp: sample.timestamp + 3000 });
    const clear = remote.clear();
    finish();
    await Promise.all([sent, queued, clear]);
    expect(calls).toEqual(['zuno_publish_location', 'zuno_stop_location']);
  });
  it('does not send another publication after the account session closes', async () => {
    const rpc = vi.fn();
    const remote = new SupabaseSocial(scopedClient(rpc, user), user);
    remote.close();
    await remote.publish(sample);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects a command if the current account changed', async () => {
    const rpc = vi.fn();
    const remote = new SupabaseSocial(scopedClient(rpc, peer), user);
    await expect(remote.call('zuno_bootstrap')).rejects.toThrow('Session ended');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('propagates failed writes instead of claiming they were saved', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'offline' } }));
    const remote = new SupabaseSocial(scopedClient(rpc, user), user);
    await expect(
      remote.action(
        { type: 'friend', id: peer, operation: 'add', now: new Date().toISOString() },
        emptyCloud(user),
      ),
    ).rejects.toEqual({ message: 'offline' });
  });
});
