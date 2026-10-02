// Real Auth + PostgREST + Realtime + Storage tests. Local loopback only; never hosted.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
const status = spawnSync('npx', ['--yes', 'supabase@2.119.0', 'status', '-o', 'json'], {
  encoding: 'utf8',
});
if (status.status !== 0) throw new Error('Start the isolated local Supabase stack first.');
const settings = JSON.parse(status.stdout);
const url = settings.API_URL;
assert.match(
  url,
  /^http:\/\/127\.0\.0\.1:54341$/,
  'Refusing to test a non-local or different project',
);
const key = settings.ANON_KEY;
assert(key, 'Local anonymous client key unavailable');
const client = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
const tag = randomUUID().slice(0, 8),
  password = randomBytes(24).toString('base64url');
const users = [];
const channels = [];
const results = [];
const transportErrors = [];
const ok = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};
const rpc = async (c, name, args) => ok(await c.rpc(name, args));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deadline = async (check, label, ms = 12000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (transportErrors.length) throw transportErrors[0];
    if (check()) return;
    await pause(100);
  }
  throw new Error(`Timed out: ${label}`);
};
const pass = (label) => {
  results.push(label);
  console.log(`PASS: ${label}`);
};
async function account(label) {
  const c = client();
  const email = `zuno-${label}-${tag}@example.com`;
  const data = ok(await c.auth.signUp({ email, password }));
  assert(data.session, 'Local email confirmation must be disabled');
  const u = { c, id: data.user.id, email };
  users.push(u);
  await rpc(c, 'zuno_bootstrap');
  await rpc(c, 'zuno_save_profile', { display_name: label, username: `${label}_${tag}` });
  return u;
}
async function inbox(u, events, topic = `zuno:user:${u.id}`) {
  await u.c.realtime.setAuth();
  const ch = u.c.channel(topic, { config: { private: true } });
  channels.push([u.c, ch]);
  let state = '';
  ch.on('broadcast', { event: 'location' }, async (v) => {
    try {
      assert(
        Object.keys(v.payload).every((key) => key === 'id'),
        'Broadcast must not retain GPS fields',
      );
      const fixes = await rpc(u.c, 'zuno_live_updates');
      events.push(...fixes);
    } catch (error) {
      transportErrors.push(error);
    }
  });
  ch.subscribe((s) => {
    state = s;
  });
  await deadline(
    () => state === 'SUBSCRIBED' || state === 'CHANNEL_ERROR',
    'channel authorization',
  );
  return { ch, state };
}
async function publish(u, lat = 25.79, lng = -80.14) {
  return rpc(u.c, 'zuno_publish_location', {
    lat,
    lng,
    speed_mps: 11.176,
    heading: 90,
    accuracy: 8,
    sampled_at: new Date().toISOString(),
  });
}
try {
  const A = await account('alice'),
    B = await account('bob'),
    C = await account('cara');
  const b = [],
    c = [];
  assert.equal((await inbox(B, b)).state, 'SUBSCRIBED');
  assert.equal((await inbox(C, c)).state, 'SUBSCRIBED');
  const unauthorized = await inbox(C, [], `zuno:user:${A.id}`);
  assert.equal(unauthorized.state, 'CHANNEL_ERROR');
  await C.c.removeChannel(unauthorized.ch);
  for (const u of users)
    await rpc(u.c, 'zuno_watch_map', { lat: 25.79, lng: -80.14, radius_m: 10000 });
  pass('three independent authenticated accounts; private inbox denies another UUID');
  assert.equal(await publish(A), false);
  assert.deepEqual(await rpc(B.c, 'zuno_nearby_locations'), []);
  await rpc(A.c, 'zuno_friend_action', { peer: B.id, operation: 'add' });
  await rpc(B.c, 'zuno_friend_action', { peer: A.id, operation: 'accept' });
  await rpc(A.c, 'zuno_set_privacy', {
    visibility: 'friends',
    location_precision: 'precise',
    show_speed: true,
    show_heading: true,
  });
  await publish(A);
  await deadline(() => b.length === 1, 'friend broadcast');
  assert.equal(c.length, 0);
  assert.equal(Math.round(b[0].speed * 2.23694), 25);
  assert.equal(b[0].heading, 90);
  assert.equal((await rpc(B.c, 'zuno_nearby_locations')).length, 1);
  assert.deepEqual(await rpc(C.c, 'zuno_nearby_locations'), []);
  pass('friends-only movement and 25 mph; outsider has no query or subscription payload');
  await pause(2200);
  await rpc(A.c, 'zuno_set_privacy', {
    visibility: 'public',
    location_precision: 'precise',
    show_speed: true,
    show_heading: true,
  });
  await publish(A);
  await deadline(() => c.length === 1, 'public broadcast');
  pass('public nearby delivery reaches eligible non-friend');
  await rpc(B.c, 'zuno_friend_action', { peer: A.id, operation: 'block' });
  const before = b.length;
  await pause(2200);
  await publish(A, 25.7901, -80.14);
  await deadline(() => c.length === 2, 'unblocked recipient still receives');
  await pause(400);
  assert.equal(b.length, before);
  assert.deepEqual(await rpc(B.c, 'zuno_nearby_locations'), []);
  pass('blocking revokes an already-connected inbox without requiring reconnect');
  await rpc(A.c, 'zuno_set_privacy', { visibility: 'private' });
  assert.equal(await publish(A), false);
  assert.deepEqual(await rpc(C.c, 'zuno_nearby_locations'), []);
  pass('private revokes query access and stops publishing');
  await pause(2200);
  await rpc(A.c, 'zuno_set_privacy', {
    visibility: 'public',
    location_precision: 'approximate',
    show_speed: true,
    show_heading: true,
  });
  await publish(A, 25.7901, -80.1401);
  await deadline(() => c.length === 3, 'coarse broadcast');
  assert.equal(c.at(-1).speed, null);
  assert.equal(c.at(-1).heading, null);
  assert.equal(c.at(-1).coordinate.latitude, 25.8);
  pass('neighborhood projection hides precise coordinates, speed and heading');
  // A reconnect reconstructs latest state from PostgreSQL, without needing the old channel.
  await C.c.removeAllChannels();
  const durable = await rpc(C.c, 'zuno_nearby_locations');
  assert.equal(durable.length, 1);
  assert.equal(durable[0].coordinate.latitude, 25.8);
  assert.equal((await inbox(C, [])).state, 'SUBSCRIBED');
  await rpc(A.c, 'zuno_stop_location');
  assert.deepEqual(await rpc(C.c, 'zuno_nearby_locations'), []);
  pass('reconnect restores durable latest fix; stop clears it');
  await rpc(B.c, 'zuno_friend_action', { peer: A.id, operation: 'unblock' });
  await rpc(A.c, 'zuno_friend_action', { peer: B.id, operation: 'add' });
  await rpc(B.c, 'zuno_friend_action', { peer: A.id, operation: 'accept' });
  const messageId = randomUUID();
  await rpc(A.c, 'zuno_send_message', { text: 'Durable hello', peer: B.id, client_id: messageId });
  await rpc(A.c, 'zuno_send_message', { text: 'Durable hello', peer: B.id, client_id: messageId });
  assert.equal(ok(await B.c.from('zuno_messages').select('id').eq('id', messageId)).length, 1);
  assert.equal(ok(await C.c.from('zuno_messages').select('id').eq('id', messageId)).length, 0);
  await B.c.auth.signOut();
  ok(await B.c.auth.signInWithPassword({ email: B.email, password }));
  assert((await rpc(B.c, 'zuno_social_snapshot')).messages.some((m) => m.id === messageId));
  pass('durable direct chat, idempotency, membership privacy and fresh-login restoration');
  const draft = {
    title: 'Local integration meetup',
    description: 'Disposable local test',
    emoji: '☕',
    place: {
      id: 'integration',
      name: 'Test cafe',
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
  };
  const event = await rpc(A.c, 'zuno_event_action', {
    operation: 'create',
    event_id: randomUUID(),
    draft,
  });
  const race = await Promise.all(
    [B, C].map((u) => u.c.rpc('zuno_event_action', { operation: 'join', event_id: event })),
  );
  assert.equal(race.filter((v) => !v.error).length, 1);
  assert.match(race.find((v) => v.error).error.message, /full/);
  const winner = race[0].error ? C : B,
    outsider = winner === B ? C : B;
  const groupId = await rpc(winner.c, 'zuno_send_message', {
    text: 'Meetup hello',
    event_id: event,
  });
  assert.equal(ok(await outsider.c.from('zuno_messages').select('id').eq('id', groupId)).length, 0);
  await rpc(winner.c, 'zuno_event_action', { operation: 'leave', event_id: event });
  assert.equal(ok(await winner.c.from('zuno_messages').select('id').eq('id', groupId)).length, 0);
  pass('concurrent final-seat join is atomic; leaving revokes group history');
  const photo = `${A.id}/${randomUUID()}.png`;
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGWsAAAAASUVORK5CYII=',
    'base64',
  );
  ok(await A.c.storage.from('zuno-avatars').upload(photo, png, { contentType: 'image/png' }));
  assert(
    (
      await B.c.storage
        .from('zuno-avatars')
        .upload(photo, png, { contentType: 'image/png', upsert: true })
    ).error,
  );
  await rpc(A.c, 'zuno_save_profile', { display_name: 'alice', avatar_path: photo });
  const signed = ok(await B.c.storage.from('zuno-avatars').createSignedUrl(photo, 60));
  assert.equal((await fetch(signed.signedUrl)).status, 200);
  assert((await A.c.rpc('zuno_delete_my_account')).error);
  ok(await A.c.storage.from('zuno-avatars').remove([photo]));
  pass('real Storage upload/read, cross-account overwrite denial and deletion preflight');
  const anon = client();
  assert((await anon.from('zuno_profiles').select('user_id')).error);
  assert((await anon.rpc('zuno_social_snapshot')).error);
  assert((await A.c.from('zuno_live_locations').select('*')).error);
  await anon.removeAllChannels();
  pass('anonymous access and direct raw-GPS reads are denied');
  console.log(`Local integration result: PASS (${results.length} checks)`);
} finally {
  for (const [c, ch] of channels) await c.removeChannel(ch).catch(() => undefined);
  for (const u of users) {
    const files = await u.c.storage.from('zuno-avatars').list(u.id);
    if (files.data?.length)
      await u.c.storage.from('zuno-avatars').remove(files.data.map((f) => `${u.id}/${f.name}`));
    const { error } = await u.c.rpc('zuno_delete_my_account');
    if (error) console.error('Local test account cleanup needs review.');
    await u.c.removeAllChannels();
    await u.c.auth.signOut();
  }
}
