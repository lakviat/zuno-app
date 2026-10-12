begin;
-- Optional social profile information; existing profile RLS remains unchanged.
alter table public.zuno_profiles add column instagram text not null default ''
  check (instagram = '' or instagram ~ '^[a-z0-9._]{1,30}$');

-- A distinct RPC preserves the existing signature used by older clients and onboarding.
-- The profile and Instagram handle save atomically for auth.uid() only.
create function public.zuno_save_profile_details(
  display_name text, instagram text, bio text default '', username text default null,
  avatar_path text default null, status text default '', availability text default 'busy', intent text default ''
) returns void language plpgsql security definer set search_path='' as $$
declare u uuid := zuno_private.require_user(); handle text := lower(trim(instagram));
begin
  if handle is null or (handle <> '' and handle !~ '^[a-z0-9._]{1,30}$') then
    raise exception 'Invalid Instagram username';
  end if;
  perform public.zuno_save_profile(display_name,bio,username,avatar_path,status,availability,intent);
  update public.zuno_profiles set instagram=handle where user_id=u;
end;
$$;

create or replace function zuno_private.person_json(p public.zuno_profiles)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('user',jsonb_build_object('id',p.user_id,'createdAt',p.created_at),
 'profile',jsonb_build_object('userId',p.user_id,'displayName',p.display_name,'username',p.username,'bio',p.bio,'instagram',p.instagram,'avatar',coalesce(p.avatar_path,''),'color','#FF6857'),
 'presence',jsonb_build_object('userId',p.user_id,'kind','recent','status',p.status,'emoji','☀️','updatedAt',p.updated_at,'freeNow',p.availability='free' and p.available_until>now(),'availability',p.availability,'intent',p.intent,'availableUntil',p.available_until));
$$;
revoke all on function public.zuno_save_profile_details(text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.zuno_save_profile_details(text,text,text,text,text,text,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
