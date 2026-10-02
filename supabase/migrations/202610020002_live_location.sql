begin;
create table public.zuno_live_locations (
 user_id uuid primary key references auth.users on delete cascade,
 location extensions.geography(Point,4326) not null,
 speed_mps double precision check(speed_mps between 0 and 70),
 heading double precision check(heading >= 0 and heading < 360),
 accuracy double precision not null check(accuracy between 0 and 65),
 sampled_at timestamptz not null, updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '90 seconds'
);
create index zuno_live_locations_geo on public.zuno_live_locations using gist(location);
create index zuno_live_locations_expiry on public.zuno_live_locations(expires_at);
alter table public.zuno_live_locations enable row level security;
revoke all on public.zuno_live_locations from anon,authenticated;
-- No direct SELECT of raw GPS, including via Realtime Postgres Changes. Authorized projections only.
create table zuno_private.map_watches (
 user_id uuid primary key references auth.users on delete cascade,
 center extensions.geography(Point,4326) not null,
 radius_m double precision not null check(radius_m between 100 and 50000),
 expires_at timestamptz not null
);
create index zuno_map_watches_geo on zuno_private.map_watches using gist(center);
-- This rate/lease row contains no coordinates and no history.
create table zuno_private.location_leases (
 user_id uuid primary key references auth.users on delete cascade,
 published_at timestamptz not null default '-infinity', sampled_at timestamptz not null default '-infinity',
 active boolean not null default false
);
alter table zuno_private.map_watches enable row level security;
alter table zuno_private.location_leases enable row level security;
revoke all on all tables in schema zuno_private from anon,authenticated;

-- Fast transport cache: one UNLOGGED fix per user, no WAL/history and no client table access.
-- A database restart may discard this cache; durable latest fixes reconstruct the map.
create unlogged table zuno_private.location_frames (
 user_id uuid primary key references auth.users on delete cascade,
 location extensions.geography(Point,4326) not null,
 speed_mps double precision, heading double precision, accuracy double precision not null,
 sampled_at timestamptz not null, expires_at timestamptz not null
);
create index zuno_location_frames_geo on zuno_private.location_frames using gist(location);
create index zuno_location_frames_expiry on zuno_private.location_frames(expires_at);
alter table zuno_private.location_frames enable row level security;
revoke all on zuno_private.location_frames from public,anon,authenticated;

create function zuno_private.require_user() returns uuid language plpgsql stable security definer set search_path='' as $$
 begin if auth.uid() is null then raise exception 'Authentication required'; end if; return auth.uid(); end;
$$;
create function zuno_private.point(lat double precision,lng double precision) returns extensions.geography language plpgsql immutable set search_path='' as $$
 begin if lat is null or lng is null or not (lat between -90 and 90 and lng between -180 and 180) then raise exception 'Invalid coordinates'; end if;
 return extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography; end;
$$;
create function zuno_private.location_allowed(subject uuid,viewer uuid) returns boolean language sql stable security definer set search_path='' as $$
 select viewer is not null and not zuno_private.blocked(subject,viewer) and exists(select 1 from public.zuno_user_privacy p where p.user_id=subject and (p.visibility='public' or (p.visibility='friends' and zuno_private.friends(subject,viewer))));
$$;
-- Only the server sends to per-user inboxes. Cached channel authorization cannot retain another user's GPS access.
create policy zuno_realtime_inbox on realtime.messages for select to authenticated
 using (extension='broadcast' and realtime.topic()='zuno:user:' || (select auth.uid())::text);
create function zuno_private.notify_user(recipient uuid,event text,payload jsonb default '{}'::jsonb) returns void language plpgsql security definer set search_path='' as $$
 begin perform realtime.send(payload,event,'zuno:user:' || recipient::text,true); end;
$$;
create function zuno_private.location_payload(subject uuid,lat double precision,lng double precision,speed double precision,bearing double precision,acc double precision,stamp timestamptz) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('userId',subject,'coordinate',jsonb_build_object(
 'latitude',case when p.location_precision='approximate' then round((lat/0.02)::numeric)*0.02 else lat end,
 'longitude',case when p.location_precision='approximate' then round((lng/0.02)::numeric)*0.02 else lng end),
 'speed',case when p.show_speed and p.location_precision='precise' then speed end,
 'heading',case when p.show_heading and p.location_precision='precise' then bearing end,
 'accuracy',case when p.location_precision='approximate' then 2500 else acc end,
 'precision',p.location_precision,'timestamp',extract(epoch from stamp)*1000)
 from public.zuno_user_privacy p where p.user_id=subject;
$$;
-- Spatial membership uses the shared projection too, preventing small-radius probes
-- from recovering an approximate user's underlying GPS coordinate.
create function zuno_private.shared_point(subject uuid,p extensions.geography) returns extensions.geography language sql stable security definer set search_path='' as $$
 select case when v.location_precision='approximate' then zuno_private.point(
 (round((extensions.st_y(p::extensions.geometry)/0.02)::numeric)*0.02)::double precision,
 (round((extensions.st_x(p::extensions.geometry)/0.02)::numeric)*0.02)::double precision) else p end
 from public.zuno_user_privacy v where v.user_id=subject;
$$;
create function public.zuno_watch_map(lat double precision,lng double precision,radius_m double precision default 10000) returns void language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); begin
 insert into zuno_private.map_watches values(u,zuno_private.point(lat,lng),greatest(100,least(coalesce(radius_m,10000),50000)),now()+interval '75 seconds')
 on conflict(user_id) do update set center=excluded.center,radius_m=excluded.radius_m,expires_at=excluded.expires_at;
 end;
$$;
create function public.zuno_nearby_locations() returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); result jsonb; begin
 select coalesce(jsonb_agg(v.payload),'[]'::jsonb) into result from (
 select zuno_private.location_payload(l.user_id,extensions.st_y(l.location::extensions.geometry),extensions.st_x(l.location::extensions.geometry),l.speed_mps,l.heading,l.accuracy,l.sampled_at) payload
 from public.zuno_live_locations l join zuno_private.map_watches w on w.user_id=u
 where w.expires_at>now() and l.expires_at>now() and l.user_id<>u
 and zuno_private.location_allowed(l.user_id,u)
 and extensions.st_dwithin(l.location,w.center,w.radius_m+3000) and extensions.st_dwithin(zuno_private.shared_point(l.user_id,l.location),w.center,w.radius_m)
 order by l.location operator(extensions.<->) w.center limit 100) v;
 return result; end;
$$;
create function public.zuno_live_updates() returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); result jsonb; begin
 select coalesce(jsonb_agg(v.payload),'[]'::jsonb) into result from (
 select zuno_private.location_payload(l.user_id,extensions.st_y(l.location::extensions.geometry),extensions.st_x(l.location::extensions.geometry),l.speed_mps,l.heading,l.accuracy,l.sampled_at) payload
 from zuno_private.location_frames l join zuno_private.map_watches w on w.user_id=u
 where w.expires_at>now() and l.expires_at>now() and l.user_id<>u and zuno_private.location_allowed(l.user_id,u)
 and extensions.st_dwithin(l.location,w.center,w.radius_m+3000) and extensions.st_dwithin(zuno_private.shared_point(l.user_id,l.location),w.center,w.radius_m)
 order by l.location operator(extensions.<->) w.center limit 100) v;
 return result; end;
$$;
create function public.zuno_publish_location(lat double precision,lng double precision,speed_mps double precision,heading double precision,accuracy double precision,sampled_at timestamptz) returns boolean language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); p extensions.geography; lease zuno_private.location_leases; recipient uuid; payload jsonb; begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,1));
 if not exists(select 1 from public.zuno_user_privacy where user_id=u and visibility<>'private') then return false; end if;
 p:=zuno_private.point(lat,lng);
 if accuracy is null or not accuracy between 0 and 65 or sampled_at is null or sampled_at<now()-interval '90 seconds' or sampled_at>now()+interval '10 seconds'
 or (speed_mps is not null and not speed_mps between 0 and 70) or (heading is not null and not (heading>=0 and heading<360)) then raise exception 'Invalid location sample'; end if;
 insert into zuno_private.location_leases(user_id) values(u) on conflict do nothing;
 select * into lease from zuno_private.location_leases where user_id=u for update;
 if lease.published_at>now()-interval '2 seconds' or lease.sampled_at>=sampled_at then return false; end if;
 update zuno_private.location_leases set published_at=now(),sampled_at=zuno_publish_location.sampled_at,active=true where user_id=u;
 -- One durable latest fix, at most once per 30 seconds. Fast movement travels in the inbox transport.
 insert into public.zuno_live_locations values(u,p,speed_mps,heading,accuracy,sampled_at,now(),now()+interval '90 seconds')
 on conflict(user_id) do update set location=excluded.location,speed_mps=excluded.speed_mps,heading=excluded.heading,accuracy=excluded.accuracy,sampled_at=excluded.sampled_at,updated_at=now(),expires_at=excluded.expires_at
 where zuno_live_locations.updated_at<now()-interval '30 seconds';
 insert into zuno_private.location_frames values(u,p,speed_mps,heading,accuracy,sampled_at,now()+interval '90 seconds')
 on conflict(user_id) do update set location=excluded.location,speed_mps=excluded.speed_mps,heading=excluded.heading,accuracy=excluded.accuracy,sampled_at=excluded.sampled_at,expires_at=excluded.expires_at;
 for recipient in select w.user_id from zuno_private.map_watches w
 where w.expires_at>now() and w.user_id<>u and zuno_private.location_allowed(u,w.user_id) and extensions.st_dwithin(w.center,p,w.radius_m+3000) and extensions.st_dwithin(w.center,zuno_private.shared_point(u,p),w.radius_m)
 order by w.center operator(extensions.<->) p limit 200 loop
 -- The broker retains DB broadcasts for several days: NEVER put GPS in this payload.
 perform zuno_private.notify_user(recipient,'location','{}'::jsonb);
 end loop;
 return true; end;
$$;
create function zuno_private.clear_location(u uuid) returns void language plpgsql security definer set search_path='' as $$
 declare r uuid; p extensions.geography; begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,1));
 select location into p from public.zuno_live_locations where user_id=u;
 for r in select user_id from zuno_private.map_watches where expires_at>now() and (user_id=u or (p is not null and extensions.st_dwithin(center,p,radius_m+7000))) loop
 perform zuno_private.notify_user(r,'location_removed',jsonb_build_object('userId',u)); end loop;
 delete from public.zuno_live_locations where user_id=u;
 delete from zuno_private.location_frames where user_id=u;
 update zuno_private.location_leases set active=false where user_id=u;
 end;
$$;
create function public.zuno_stop_location() returns void language plpgsql security definer set search_path='' as $$
 begin perform zuno_private.clear_location(zuno_private.require_user()); end;
$$;
create function public.zuno_set_privacy(visibility text,location_precision text default 'precise',show_speed boolean default false,show_heading boolean default false,units text default 'mph') returns void language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); begin
 perform zuno_private.clear_location(u);
 insert into public.zuno_user_privacy values(u,visibility,location_precision,show_speed,show_heading,units,now())
 on conflict(user_id) do update set visibility=excluded.visibility,location_precision=excluded.location_precision,show_speed=excluded.show_speed,show_heading=excluded.show_heading,units=excluded.units,updated_at=now();
 perform zuno_private.notify_user(u,'sync'); end;
$$;
-- Account deletion is also a synchronous sharing revocation.
create function zuno_private.before_account_delete() returns trigger language plpgsql security definer set search_path='' as $$
 begin perform zuno_private.clear_location(old.id); return old; end;
$$;
create trigger zuno_revoke_location before delete on auth.users for each row execute function zuno_private.before_account_delete();
revoke all on all functions in schema zuno_private from public,anon,authenticated;
grant execute on function zuno_private.blocked(uuid,uuid),zuno_private.friends(uuid,uuid),zuno_private.event_visible(uuid,uuid),zuno_private.chat_visible(uuid,uuid),zuno_private.profile_visible(uuid,uuid) to authenticated;
revoke all on function public.zuno_watch_map(double precision,double precision,double precision), public.zuno_nearby_locations(), public.zuno_live_updates(), public.zuno_publish_location(double precision,double precision,double precision,double precision,double precision,timestamptz),public.zuno_stop_location(),public.zuno_set_privacy(text,text,boolean,boolean,text) from public,anon;
grant execute on function public.zuno_watch_map(double precision,double precision,double precision), public.zuno_nearby_locations(), public.zuno_live_updates(), public.zuno_publish_location(double precision,double precision,double precision,double precision,double precision,timestamptz),public.zuno_stop_location(),public.zuno_set_privacy(text,text,boolean,boolean,text) to authenticated;
commit;
