import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
const A = '10000000-0000-0000-0000-000000000001';
const B = '20000000-0000-0000-0000-000000000002';
let db: PGlite;
const as = async (role: 'authenticated' | 'anon', id = '') => {
  await db.exec(`reset role; set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users(id) values ('${A}'),('${B}');`);
  await db.exec(
    readFileSync(
      new URL('../../supabase/migrations/202610010001_account_foundation.sql', import.meta.url),
      'utf8',
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe('Postgres row-level security (real migration)', () => {
  it('allows each authenticated owner to create and read their own profile', async () => {
    for (const id of [A, B]) {
      await as('authenticated', id);
      await db.query('insert into public.zuno_profiles(user_id,display_name) values ($1,$2)', [
        id,
        'Private profile',
      ]);
      const { rows } = await db.query<{ user_id: string }>(
        'select user_id from public.zuno_profiles',
      );
      expect(rows).toEqual([{ user_id: id }]);
    }
  });
  it('denies anonymous table access and the account-deletion RPC', async () => {
    await as('anon');
    await expect(db.query('select * from public.zuno_profiles')).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query('select public.zuno_delete_my_account()')).rejects.toThrow(
      /permission denied/,
    );
  });
  it('cannot spoof another owner, edit or delete their row', async () => {
    await as('authenticated', A);
    await expect(
      db.query('insert into public.zuno_profiles(user_id,display_name) values ($1,$2)', [
        B,
        'Spoof',
      ]),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          'update public.zuno_profiles set display_name=$1 where user_id=$2 returning *',
          ['Hacked', B],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (await db.query('delete from public.zuno_profiles where user_id=$1 returning *', [B])).rows,
    ).toEqual([]);
    await expect(
      db.query('update public.zuno_profiles set user_id=$1 where user_id=$2', [B, A]),
    ).rejects.toThrow();
  });
  it('supports owner update/upsert and rejects invalid profile content', async () => {
    await as('authenticated', A);
    await db.query(
      `insert into public.zuno_profiles(user_id,display_name,bio) values ($1,'Updated','Hello')
      on conflict(user_id) do update set display_name=excluded.display_name, bio=excluded.bio`,
      [A],
    );
    expect(
      (await db.query<{ display_name: string }>('select display_name from public.zuno_profiles'))
        .rows[0].display_name,
    ).toBe('Updated');
    await expect(db.query("update public.zuno_profiles set display_name='' ")).rejects.toThrow();
    await expect(
      db.query('update public.zuno_profiles set bio=$1', ['x'.repeat(161)]),
    ).rejects.toThrow();
  });
  it('deletes only the authenticated account and cascades its profile', async () => {
    await as('authenticated', A);
    await db.query('select public.zuno_delete_my_account()');
    await db.exec('reset role');
    expect((await db.query('select id from auth.users order by id')).rows).toEqual([{ id: B }]);
    expect((await db.query('select user_id from public.zuno_profiles')).rows).toEqual([
      { user_id: B },
    ]);
  });
  it('denies a missing user identity even under the authenticated role', async () => {
    await as('authenticated');
    expect((await db.query('select * from public.zuno_profiles')).rows).toEqual([]);
    await expect(db.query('select public.zuno_delete_my_account()')).rejects.toThrow(
      /Authentication required/,
    );
  });
});
