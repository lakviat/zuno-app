-- First Zuno cloud slice: private account profiles. No social/location data is uploaded.
-- Apply once to the selected Zuno project. Fail rather than overwrite an existing object.
begin;
create table public.zuno_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 160),
  updated_at timestamptz not null default now()
);
alter table public.zuno_profiles enable row level security;
revoke all on public.zuno_profiles from anon, authenticated;
grant select, insert, update, delete on public.zuno_profiles to authenticated;
create policy zuno_profile_read on public.zuno_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy zuno_profile_create on public.zuno_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy zuno_profile_update on public.zuno_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy zuno_profile_delete on public.zuno_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

create function public.zuno_profile_timestamp() returns trigger language plpgsql
  set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.zuno_profile_timestamp() from public, anon, authenticated;
create trigger zuno_profile_timestamp before update on public.zuno_profiles
  for each row execute function public.zuno_profile_timestamp();

-- Allows deletion of only the caller's own account, without an administrative app key.
-- No target user ID can be supplied by the client. The profile is removed by its FK.
create function public.zuno_delete_my_account() returns void language plpgsql
  security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.zuno_delete_my_account() from public, anon;
grant execute on function public.zuno_delete_my_account() to authenticated;
commit;
