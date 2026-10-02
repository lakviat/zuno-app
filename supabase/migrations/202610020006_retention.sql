begin;
create index zuno_map_watch_expiry on zuno_private.map_watches(expires_at);
create index zuno_location_lease_age on zuno_private.location_leases(published_at);
create function zuno_private.expire_location_state() returns void language plpgsql security definer set search_path='' as $$
 begin
 delete from public.zuno_live_locations where expires_at<now();
 delete from zuno_private.location_frames where expires_at<now();
 delete from zuno_private.map_watches where expires_at<now()-interval '1 hour';
 delete from zuno_private.location_leases where published_at<now()-interval '1 day';
 end;
$$;
revoke all on function zuno_private.expire_location_state() from public,anon,authenticated;
-- PGlite does not ship pg_cron. Hosted Supabase does; its scheduler is verified after deployment.
do $$ begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
 create extension if not exists pg_cron with schema pg_catalog;
 perform cron.schedule('zuno-expire-location-state','*/5 * * * *','select zuno_private.expire_location_state()');
 end if;
end $$;
commit;
