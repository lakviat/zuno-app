-- Transactional hosted regression: synthetic identity and all data are rolled back.
begin;
set local statement_timeout='30s';
create function pg_temp.welcome_assert(label text,passed boolean) returns void language plpgsql as $$begin
 if passed is distinct from true then raise exception 'FAIL: %',label; end if;
end$$;
select pg_temp.welcome_assert('identity absent',not exists(select 1 from auth.users where id='bc890fe3-9670-4d8e-bf02-000000000013'));
insert into auth.users(id) values('bc890fe3-9670-4d8e-bf02-000000000013');
set local role authenticated;
select set_config('request.jwt.claim.sub','bc890fe3-9670-4d8e-bf02-000000000013',true);
select set_config('request.jwt.claims','{"sub":"bc890fe3-9670-4d8e-bf02-000000000013","role":"authenticated"}',true);
select public.zuno_onboarding_state();
select pg_temp.welcome_assert('new status and finite availability',exists(select 1 from public.zuno_profiles where user_id=auth.uid() and status='Hey, I am available' and availability='free' and available_until=now()+interval '2 hours'));
select public.zuno_onboarding_profile('Welcome test','hosted_welcome_status');
select pg_temp.welcome_assert('profile save keeps welcome',exists(select 1 from public.zuno_profiles where user_id=auth.uid() and status='Hey, I am available' and availability='free'));
select pg_temp.welcome_assert('location stays private before confirmation',(public.zuno_onboarding_state()->>'visibility')='private');
select public.zuno_complete_onboarding('public');
select public.zuno_save_profile('Welcome test','','hosted_welcome_status',null,'Working today','busy','');
select public.zuno_bootstrap();
select public.zuno_complete_onboarding('friends');
select pg_temp.welcome_assert('returning status preserved',exists(select 1 from public.zuno_profiles where user_id=auth.uid() and status='Working today' and availability='busy'));
select pg_temp.welcome_assert('returning visibility preserved',(public.zuno_onboarding_state()->>'visibility')='public');
reset role;
select pg_temp.welcome_assert('no GPS created',not exists(select 1 from public.zuno_live_locations where user_id='bc890fe3-9670-4d8e-bf02-000000000013'));
select pg_temp.welcome_assert('anonymous RPC denied',not has_function_privilege('anon','public.zuno_onboarding_profile(text,text,text,text)','EXECUTE'));
select pg_temp.welcome_assert('onboarding RLS retained',(select relrowsecurity from pg_class where oid='public.zuno_onboarding'::regclass));
rollback;
select 9 as passed_checks,not exists(select 1 from auth.users where id='bc890fe3-9670-4d8e-bf02-000000000013') as rollback_clean;
