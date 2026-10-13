begin;
-- New profiles have a welcoming, time-limited availability. Existing profiles and
-- privacy choices are deliberately untouched; bootstrap still starts private.
alter table public.zuno_profiles
 alter column status set default 'Hey, I am available',
 alter column availability set default 'free',
 alter column available_until set default (now() + interval '2 hours');

create or replace function public.zuno_onboarding_profile(name text,username text,bio text default '',avatar text default null) returns void language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); p public.zuno_profiles; begin
 perform public.zuno_onboarding_state();
 perform 1 from public.zuno_onboarding where user_id=u for update;
 if exists(select 1 from public.zuno_onboarding where user_id=u and step='complete') then raise exception 'Onboarding already complete'; end if;
 if trim(name)='' or lower(trim(username)) !~ '^[a-z0-9_]{3,40}$' then raise exception 'Enter a name and valid username'; end if;
 select * into p from public.zuno_profiles where user_id=u;
 -- Passing the profile's status avoids the legacy save RPC's busy defaults.
 perform public.zuno_save_profile(name,bio,username,avatar,p.status,p.availability,p.intent);
 update public.zuno_onboarding set step='location',draft_name=trim(name),draft_username=lower(trim(username)),draft_bio=trim(bio),updated_at=now() where user_id=u;
 end;
$$;
commit;
