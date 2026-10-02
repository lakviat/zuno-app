-- Hosted multi-user SQL/RLS tests. Three synthetic identities; NO passwords, emails sent or persistent test data.
-- Every row and broker notice is rolled back. This does not claim a real GoTrue sign-in/WebSocket round trip.
begin;
set local statement_timeout = '45s';
create temporary table zuno_test_results(label text primary key) on commit drop;
grant insert,select on zuno_test_results to authenticated,anon;
create function pg_temp.assert_true(label text,passed boolean) returns void language plpgsql as $$begin
 if passed is distinct from true then raise exception 'FAIL: %',label; end if;
 insert into zuno_test_results values(label); end$$;
create function pg_temp.expect_error(label text,statement text,pattern text) returns void language plpgsql as $$begin
 begin execute statement; exception when others then
 if sqlerrm !~* pattern then raise exception 'FAIL: %: unexpected %',label,sqlerrm; end if;
 insert into zuno_test_results values(label); return; end;
 raise exception 'FAIL: %: request unexpectedly succeeded',label; end$$;

select pg_temp.assert_true('isolated onboarding test identities absent',not exists(select 1 from auth.users where id in ('bc890fe3-9670-4d8e-bf02-000000000001','bc890fe3-9670-4d8e-bf02-000000000002')));
insert into auth.users(id,raw_user_meta_data) values('bc890fe3-9670-4d8e-bf02-000000000001','{"full_name":"Provider Default"}'),('bc890fe3-9670-4d8e-bf02-000000000002','{}');
reset role; set local role authenticated; select set_config('request.jwt.claim.sub','bc890fe3-9670-4d8e-bf02-000000000001',true); select set_config('request.jwt.claims','{"sub":"bc890fe3-9670-4d8e-bf02-000000000001","role":"authenticated"}',true);
select pg_temp.assert_true('provider name initializes once',(public.zuno_onboarding_state()->>'name')='Provider Default');
select pg_temp.assert_true('new user starts at profile',(public.zuno_onboarding_state()->>'step')='profile');
select pg_temp.assert_true('new user stays private',(public.zuno_onboarding_state()->>'visibility')='private');
select pg_temp.expect_error('cannot skip profile','select public.zuno_complete_onboarding(''public'')','Complete your profile');
select public.zuno_save_onboarding_draft('Alice','HOSTED_AUTH_ALICE','draft');
select pg_temp.assert_true('draft survives state reload',(public.zuno_onboarding_state()->>'username')='hosted_auth_alice');
reset role; set local role authenticated; select set_config('request.jwt.claim.sub','bc890fe3-9670-4d8e-bf02-000000000002',true); select set_config('request.jwt.claims','{"sub":"bc890fe3-9670-4d8e-bf02-000000000002","role":"authenticated"}',true);
select pg_temp.assert_true('other user cannot read progress',not exists(select 1 from public.zuno_onboarding));
select pg_temp.expect_error('direct state mutation denied','update public.zuno_onboarding set step=''complete''','permission denied');
select public.zuno_onboarding_profile('Bob','hosted_auth_bob');
reset role; set local role authenticated; select set_config('request.jwt.claim.sub','bc890fe3-9670-4d8e-bf02-000000000001',true); select set_config('request.jwt.claims','{"sub":"bc890fe3-9670-4d8e-bf02-000000000001","role":"authenticated"}',true);
select pg_temp.assert_true('case normalized availability',public.zuno_username_available('HOSTED_AUTH_BOB')=false);
select pg_temp.expect_error('duplicate username denied','select public.zuno_onboarding_profile(''Alice'',''HOSTED_AUTH_BOB'')','duplicate|unique');
select pg_temp.expect_error('invalid username denied','select public.zuno_onboarding_profile(''Alice'',''bad-name'')','valid username');
select public.zuno_onboarding_profile('Alice','hosted_auth_alice');
select pg_temp.assert_true('profile advances to location',(public.zuno_onboarding_state()->>'step')='location');
select pg_temp.expect_error('invalid visibility denied','select public.zuno_complete_onboarding(''everybody'')','Invalid|check constraint');
select public.zuno_complete_onboarding('friends');
select pg_temp.assert_true('completion is persisted',(public.zuno_onboarding_state()->>'completedAt') is not null);
select pg_temp.assert_true('friends choice is respected',(public.zuno_onboarding_state()->>'visibility')='friends');
select public.zuno_complete_onboarding('public'); select public.zuno_save_onboarding_draft('Overwrite','overwrite');
select pg_temp.assert_true('completion retry never broadens sharing',(public.zuno_onboarding_state()->>'visibility')='friends');
select pg_temp.assert_true('returning account keeps customized name',(public.zuno_onboarding_state()->>'name')='Alice');
reset role; set local role anon;
select pg_temp.expect_error('anonymous onboarding access denied','select public.zuno_onboarding_state()','permission denied');
reset role; rollback;
select '["isolated onboarding test identities absent", "provider name initializes once", "new user starts at profile", "new user stays private", "cannot skip profile", "draft survives state reload", "other user cannot read progress", "direct state mutation denied", "case normalized availability", "duplicate username denied", "invalid username denied", "profile advances to location", "invalid visibility denied", "completion is persisted", "friends choice is respected", "completion retry never broadens sharing", "returning account keeps customized name", "anonymous onboarding access denied"]'::jsonb as passed_checks, not exists(select 1 from auth.users where id in ('bc890fe3-9670-4d8e-bf02-000000000001','bc890fe3-9670-4d8e-bf02-000000000002')) as rollback_clean;
