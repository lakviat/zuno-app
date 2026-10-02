begin;
-- Owner-only progress. Never expose setup state through public/social profiles.
create table public.zuno_onboarding (
 user_id uuid primary key references auth.users(id) on delete cascade,
 step text not null default 'profile' check(step in ('profile','location','complete')),
 draft_name text not null default '' check(length(draft_name)<=40),
 draft_username text not null default '' check(length(draft_username)<=40),
 draft_bio text not null default '' check(length(draft_bio)<=160),
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 check ((step='complete')=(completed_at is not null))
);
alter table public.zuno_onboarding enable row level security;
revoke all on public.zuno_onboarding from public,anon,authenticated;
grant select on public.zuno_onboarding to authenticated;
create policy zuno_onboarding_owner on public.zuno_onboarding for select to authenticated using(user_id=(select auth.uid()));

create function public.zuno_onboarding_state() returns jsonb language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); result jsonb; begin
 perform public.zuno_bootstrap();
 insert into public.zuno_onboarding(user_id,draft_name,draft_username,draft_bio)
 select u, case when p.display_name='New friend' then left(coalesce(a.raw_user_meta_data->>'full_name',a.raw_user_meta_data->>'name',''),40) else p.display_name end,
 case when p.username='user_'||replace(u::text,'-','') then '' else p.username end,p.bio
 from public.zuno_profiles p join auth.users a on a.id=p.user_id where p.user_id=u on conflict do nothing;
 select jsonb_build_object('step',o.step,'completedAt',o.completed_at,'name',o.draft_name,'username',o.draft_username,'bio',o.draft_bio,'avatar',p.avatar_path,'visibility',v.visibility)
 into result from public.zuno_onboarding o join public.zuno_profiles p using(user_id) join public.zuno_user_privacy v using(user_id) where o.user_id=u;
 return result; end;
$$;
create function public.zuno_save_onboarding_draft(name text,username text,bio text default '') returns void language plpgsql security definer set search_path='' as $$
 begin
 perform public.zuno_onboarding_state();
 update public.zuno_onboarding set draft_name=trim(name),draft_username=lower(trim(username)),draft_bio=trim(bio),updated_at=now() where user_id=zuno_private.require_user() and step<>'complete';
 end;
$$;
create function public.zuno_username_available(candidate text) returns boolean language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); n text:=lower(trim(candidate)); begin
 return n ~ '^[a-z0-9_]{3,40}$' and not exists(select 1 from public.zuno_profiles where username=n and user_id<>u);
 end;
$$;
create function public.zuno_onboarding_profile(name text,username text,bio text default '',avatar text default null) returns void language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); begin
 perform public.zuno_onboarding_state();
 if exists(select 1 from public.zuno_onboarding where user_id=u and step='complete') then raise exception 'Onboarding already complete'; end if;
 if trim(name)='' or lower(trim(username)) !~ '^[a-z0-9_]{3,40}$' then raise exception 'Enter a name and valid username'; end if;
 perform public.zuno_save_profile(name,bio,username,avatar);
 update public.zuno_onboarding set step='location',draft_name=trim(name),draft_username=lower(trim(username)),draft_bio=trim(bio),updated_at=now() where user_id=u;
 end;
$$;
create function public.zuno_complete_onboarding(visibility text) returns void language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); begin
 -- Lock progress to prevent concurrent completion/profile requests crossing stages.
 perform 1 from public.zuno_onboarding where user_id=u and step in ('location','complete') for update;
 if not found then raise exception 'Complete your profile first'; end if;
 if exists(select 1 from public.zuno_onboarding where user_id=u and step='complete') then return; end if;
 perform public.zuno_set_privacy(visibility);
 update public.zuno_onboarding set step='complete',completed_at=now(),updated_at=now() where user_id=u;
 end;
$$;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('zuno_onboarding_state','zuno_save_onboarding_draft','zuno_username_available','zuno_onboarding_profile','zuno_complete_onboarding') loop
 execute format('revoke all on function %s from public,anon',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
commit;
