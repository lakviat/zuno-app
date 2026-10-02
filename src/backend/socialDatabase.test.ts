import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
const A = '10000000-0000-0000-0000-000000000001',
  B = '20000000-0000-0000-0000-000000000002',
  C = '30000000-0000-0000-0000-000000000003';
let db: PGlite;
const as = async (id: string) => {
  await db.exec('reset role; set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
};
const rpc = async (name: string, args: unknown[] = []) => {
  const { rows } = await db.query<{ value: unknown }>(
    `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as value`,
    args,
  );
  return rows[0]?.value;
};
beforeAll(async () => {
  db = new PGlite({ extensions: { postgis } });
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;
 create schema realtime;create table realtime.messages(extension text,topic text);alter table realtime.messages enable row level security;
 create function realtime.topic() returns text language sql stable as $$select current_setting('test.topic',true)$$;
 create table realtime.outbox(topic text,event text,payload jsonb,private boolean);
 create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql as $$insert into realtime.outbox values(topic,event,payload,private)$$;
 grant usage on schema realtime to authenticated;grant select on realtime.messages to authenticated;
 insert into auth.users(id) values('${A}'),('${B}'),('${C}');`);
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of readdirSync(dir).sort())
    await db.exec(readFileSync(new URL(file, dir), 'utf8'));
  for (const id of [A, B, C]) {
    await as(id);
    await rpc('zuno_bootstrap');
  }
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe('real Postgres + PostGIS social authorization', () => {
  it('persists owner-only onboarding, resumes stages and never re-applies provider defaults', async () => {
    await db.exec('reset role; begin');
    try {
      await as(A);
      expect(((await rpc('zuno_onboarding_state')) as { step: string }).step).toBe('profile');
      await expect(rpc('zuno_complete_onboarding', ['public'])).rejects.toThrow(
        /Complete your profile/,
      );
    } finally {
      await db.exec('rollback; reset role');
    }
    await db.exec('begin');
    try {
      await as(A);
      await rpc('zuno_save_onboarding_draft', ['Alice', 'ALICE_FIRST', 'draft']);
      expect(await rpc('zuno_onboarding_state')).toMatchObject({
        name: 'Alice',
        username: 'alice_first',
        step: 'profile',
        visibility: 'private',
      });
      await as(B);
      expect((await db.query('select * from public.zuno_onboarding')).rows).toEqual([]);
      await rpc('zuno_onboarding_state');
      await rpc('zuno_onboarding_profile', ['Bob', 'BOB_FIRST']);
      expect(await rpc('zuno_username_available', ['bob_first'])).toBe(true);
      await as(A);
      expect(await rpc('zuno_username_available', ['BOB_FIRST'])).toBe(false);
      await rpc('zuno_onboarding_profile', ['Alice', 'ALICE_FIRST']);
      expect(await rpc('zuno_onboarding_state')).toMatchObject({
        step: 'location',
        username: 'alice_first',
      });
      await rpc('zuno_complete_onboarding', ['friends']);
      expect(await rpc('zuno_onboarding_state')).toMatchObject({
        step: 'complete',
        visibility: 'friends',
      });
      await rpc('zuno_complete_onboarding', ['public']);
      await rpc('zuno_save_onboarding_draft', ['Wrong provider name', 'bad_new']);
      expect(await rpc('zuno_onboarding_state')).toMatchObject({
        name: 'Alice',
        username: 'alice_first',
        visibility: 'friends',
        step: 'complete',
      });
    } finally {
      await db.exec('rollback; reset role');
    }
  });
  it('starts private, preserves a single profile and denies raw GPS/table writes', async () => {
    await as(A);
    const snapshot = (await rpc('zuno_social_snapshot')) as {
      privacy: { mode: string };
      people: unknown[];
    };
    expect(snapshot.privacy.mode).toBe('hidden');
    expect(snapshot.people).toHaveLength(1);
    await expect(db.query('select * from public.zuno_live_locations')).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.query(
        `insert into public.zuno_friendships(requester_id,addressee_id)values('${A}','${B}')`,
      ),
    ).rejects.toThrow(/permission denied/);
    await rpc('zuno_save_profile', ['Alice', 'Hello', 'alice_zuno']);
    expect(await rpc('zuno_search_people', ['bob_zuno'])).toEqual([]);
    await as(B);
    await rpc('zuno_save_profile', ['Bob', '', 'bob_zuno']);
    await as(A);
    expect(await rpc('zuno_search_people', ['bob_zuno'])).toHaveLength(1);
  });
  it('deduplicates reciprocal requests and only addressee accepts', async () => {
    await as(A);
    await rpc('zuno_friend_action', [B, 'add']);
    await expect(rpc('zuno_friend_action', [B, 'accept'])).rejects.toThrow(/Request unavailable/);
    await as(B);
    await rpc('zuno_friend_action', [A, 'add']);
    await rpc('zuno_friend_action', [A, 'accept']);
    expect((await db.query('select * from public.zuno_friendships')).rows).toHaveLength(1);
  });
  it('public GPS is spatially bounded, measured speed persists, and only own inbox can subscribe', async () => {
    await as(B);
    await rpc('zuno_watch_map', [25.79, -80.14, 10000]);
    await as(C);
    await rpc('zuno_watch_map', [40, -74, 10000]);
    await as(A);
    await rpc('zuno_set_privacy', ['public', 'precise', true, true, 'mph']);
    await rpc('zuno_publish_location', [25.79, -80.14, 11.176, 90, 8, new Date().toISOString()]);
    await as(B);
    const locations = (await rpc('zuno_nearby_locations')) as { speed: number }[];
    expect(locations).toHaveLength(1);
    expect(Math.round(locations[0].speed * 2.23694)).toBe(25);
    await as(C);
    expect(await rpc('zuno_nearby_locations')).toEqual([]);
    await db.exec('reset role');
    const out = (
      await db.query<{ topic: string; private: boolean }>(
        "select * from realtime.outbox where event='location'",
      )
    ).rows;
    expect(out.map((r) => r.topic)).toEqual([`zuno:user:${B}`]);
    expect(out[0].private).toBe(true);
    expect(
      (
        await db.query<{ payload: unknown }>(
          "select payload from realtime.outbox where event='location'",
        )
      ).rows.every((r) => JSON.stringify(r.payload) === '{}'),
    ).toBe(true);
    await db.query('insert into realtime.messages values($1,$2)', ['broadcast', `zuno:user:${A}`]);
    await as(B);
    await db.query("select set_config('test.topic',$1,false)", [`zuno:user:${A}`]);
    expect((await db.query('select * from realtime.messages')).rows).toEqual([]);
  });
  it('friends excludes third party and private revokes durable and future publications', async () => {
    await as(C);
    await rpc('zuno_watch_map', [25.79, -80.14, 10000]);
    await as(A);
    await rpc('zuno_set_privacy', ['friends', 'precise', true, true, 'mph']);
    // Advance only test metadata; do not sleep for throttling.
    await db.exec('reset role');
    await db.query(
      "update zuno_private.location_leases set published_at='-infinity',sampled_at='-infinity'",
    );
    await as(A);
    await rpc('zuno_publish_location', [25.79, -80.14, 11.176, 90, 8, new Date().toISOString()]);
    await as(B);
    expect(await rpc('zuno_nearby_locations')).toHaveLength(1);
    await as(C);
    expect(await rpc('zuno_nearby_locations')).toEqual([]);
    await as(A);
    await rpc('zuno_set_privacy', ['private']);
    expect(
      await rpc('zuno_publish_location', [25.79, -80.14, 11.176, 90, 8, new Date().toISOString()]),
    ).toBe(false);
    await as(B);
    expect(await rpc('zuno_nearby_locations')).toEqual([]);
  });
  it('persists chat, denies outsiders and atomically blocks further access', async () => {
    await as(A);
    await rpc('zuno_send_message', ['Hello Bob', B]);
    await as(B);
    expect((await db.query('select text from public.zuno_messages')).rows).toEqual([
      { text: 'Hello Bob' },
    ]);
    await as(C);
    expect((await db.query('select * from public.zuno_messages')).rows).toEqual([]);
    await expect(rpc('zuno_send_message', ['Hi', A])).rejects.toThrow(/friend/);
    await as(B);
    await rpc('zuno_friend_action', [A, 'block']);
    expect((await db.query('select * from public.zuno_messages')).rows).toEqual([]);
    await as(A);
    await expect(rpc('zuno_send_message', ['No', B])).rejects.toThrow(/friend/);
    expect(await rpc('zuno_search_people', ['bob_zuno'])).toEqual([]);
  });
  it('enforces event capacity, ownership, membership and leave revocation', async () => {
    await as(A);
    const event = await rpc('zuno_event_action', [
      'create',
      null,
      JSON.stringify({
        title: 'Coffee',
        description: 'Meet here',
        emoji: '☕️',
        place: {
          id: 'test',
          name: 'Public cafe',
          area: 'Miami',
          areaId: 'miami',
          kind: 'map-pin',
          precision: 'precise',
          coordinate: { latitude: 25.79, longitude: -80.14 },
        },
        startsAt: new Date(Date.now() + 3600000).toISOString(),
        endsAt: new Date(Date.now() + 7200000).toISOString(),
        visibility: 'public',
        capacity: 2,
        invitedUserIds: [],
      }),
    ]);
    await as(B);
    await expect(rpc('zuno_event_action', ['join', event])).rejects.toThrow(/unavailable/);
    await as(C);
    await rpc('zuno_event_action', ['join', event]);
    await rpc('zuno_event_action', ['join', event]);
    await rpc('zuno_send_message', ['Group hello', null, event]);
    await expect(rpc('zuno_event_action', ['cancel', event])).rejects.toThrow(/host/);
    await as(B);
    await rpc('zuno_friend_action', [A, 'unblock']);
    await expect(rpc('zuno_event_action', ['join', event])).rejects.toThrow(/full/);
    await as(C);
    await rpc('zuno_event_action', ['leave', event]);
    expect((await db.query('select * from public.zuno_messages')).rows).toEqual([]);
    await expect(rpc('zuno_send_message', ['No longer a member', null, event])).rejects.toThrow(
      /members/,
    );
    await as(B);
    await rpc('zuno_event_action', ['join', event]);
    const snapshot = (await rpc('zuno_social_snapshot')) as { meetups: unknown[] };
    expect(snapshot.meetups).toHaveLength(1);
  });
  it('stop/revoke clears latest fix and repeated reconnect reads reconstruct state', async () => {
    await as(A);
    await rpc('zuno_set_privacy', ['public']);
    await db.exec('reset role');
    await db.exec(
      "update zuno_private.location_leases set published_at='-infinity',sampled_at='-infinity'",
    );
    await as(A);
    await rpc('zuno_publish_location', [25.79, -80.14, 0, null, 8, new Date().toISOString()]);
    await as(B);
    expect(await rpc('zuno_nearby_locations')).toHaveLength(1);
    expect(await rpc('zuno_nearby_locations')).toHaveLength(1);
    await as(A);
    await rpc('zuno_stop_location');
    await as(B);
    expect(await rpc('zuno_nearby_locations')).toEqual([]);
  });
  it('protects avatar ownership and prevents orphaned files during deletion', async () => {
    await as(A);
    await db.query('insert into storage.objects(bucket_id,name)values($1,$2)', [
      'zuno-avatars',
      A + '/photo.jpg',
    ]);
    await as(B);
    await expect(
      db.query('insert into storage.objects(bucket_id,name)values($1,$2)', [
        'zuno-avatars',
        A + '/overwrite.jpg',
      ]),
    ).rejects.toThrow(/row-level security/);
    await as(A);
    await expect(rpc('zuno_delete_my_account')).rejects.toThrow(/photos/);
    await db.query('delete from storage.objects where name=$1', [A + '/photo.jpg']);
  });
  it('denies unauthenticated RPCs and cascades self-deletion', async () => {
    await db.exec('reset role;set role anon');
    await expect(rpc('zuno_social_snapshot')).rejects.toThrow(/permission denied/);
    await as(C);
    await rpc('zuno_delete_my_account');
    await db.exec('reset role');
    expect(
      (await db.query('select * from public.zuno_profiles where user_id=$1', [C])).rows,
    ).toEqual([]);
  });
});
