-- Synthetic hosted profile checks; no emails, passwords, or persistent test data.
begin;
set local statement_timeout='30s';
create function pg_temp.profile_assert(ok boolean) returns void language plpgsql as $$begin
  if ok is distinct from true then raise exception 'Profile verification failed'; end if;
end$$;
create function pg_temp.profile_denied(statement text, pattern text) returns void language plpgsql as $$begin
  begin execute statement; exception when others then
    if sqlerrm !~* pattern then raise; end if; return;
  end;
  raise exception 'Expected profile request to be rejected';
end$$;
select pg_temp.profile_assert(not exists(select 1 from auth.users where id in ('f1200000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000002','f1200000-0000-4000-8000-000000000003')));
insert into auth.users(id,aud,role) values
 ('f1200000-0000-4000-8000-000000000001','authenticated','authenticated'),
 ('f1200000-0000-4000-8000-000000000002','authenticated','authenticated'),
 ('f1200000-0000-4000-8000-000000000003','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','f1200000-0000-4000-8000-000000000001',true);
select public.zuno_bootstrap();
select public.zuno_save_profile_details('Profile QA A','Profile.QA_A','About A','profile_qa_f120_a');
select pg_temp.profile_assert((select profile->>'instagram'='profile.qa_a' and profile->>'bio'='About A' from (select item->'profile' profile from jsonb_array_elements(public.zuno_social_snapshot()->'people') item where item->'user'->>'id'='f1200000-0000-4000-8000-000000000001') a));
select public.zuno_save_profile('Profile QA A','Updated A','profile_qa_f120_a');
select pg_temp.profile_assert((select instagram='profile.qa_a' from public.zuno_profiles where user_id=auth.uid()));
select pg_temp.profile_denied($sql$select public.zuno_save_profile_details('Wrong','https://evil.test','wrong')$sql$,'Invalid Instagram');
select pg_temp.profile_assert((select display_name='Profile QA A' and bio='Updated A' from public.zuno_profiles where user_id=auth.uid()));
select pg_temp.profile_denied($sql$update public.zuno_profiles set instagram='forged'$sql$,'permission denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','f1200000-0000-4000-8000-000000000002',true);
select public.zuno_bootstrap();
select public.zuno_save_profile_details('Profile QA B','profile.qa_b','','profile_qa_f120_b');
select pg_temp.profile_assert(not exists(select 1 from public.zuno_profiles where user_id='f1200000-0000-4000-8000-000000000001'));
select public.zuno_friend_action('f1200000-0000-4000-8000-000000000001','add');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','f1200000-0000-4000-8000-000000000001',true);
select public.zuno_friend_action('f1200000-0000-4000-8000-000000000002','accept');
select pg_temp.profile_assert((select instagram='profile.qa_a' from public.zuno_profiles where user_id=auth.uid()));
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','f1200000-0000-4000-8000-000000000002',true);
select pg_temp.profile_assert(exists(select 1 from jsonb_array_elements(public.zuno_social_snapshot()->'people') p where p->'user'->>'id'='f1200000-0000-4000-8000-000000000001' and p->'profile'->>'instagram'='profile.qa_a'));
select public.zuno_friend_action('f1200000-0000-4000-8000-000000000001','block');
select pg_temp.profile_assert(not exists(select 1 from jsonb_array_elements(public.zuno_social_snapshot()->'people') p where p->'user'->>'id'='f1200000-0000-4000-8000-000000000001'));
select pg_temp.profile_assert(jsonb_array_length(public.zuno_search_people('profile_qa_f120_a'))=0);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','f1200000-0000-4000-8000-000000000003',true);
select public.zuno_bootstrap();
select pg_temp.profile_assert(jsonb_array_length(public.zuno_social_snapshot()->'people')=1);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','f1200000-0000-4000-8000-000000000001',true);
select public.zuno_save_profile_details('Profile QA A','','Updated A','profile_qa_f120_a');
select pg_temp.profile_assert((select instagram='' from public.zuno_profiles where user_id=auth.uid()));
reset role;
set local role anon;
select pg_temp.profile_denied($sql$select public.zuno_save_profile_details('Intruder','intruder')$sql$,'permission denied');
reset role;
rollback;
select 'PASS: owner save, normalization, snapshot, legacy compatibility, invalid/atomic save, raw-write denial, owner isolation, friend visibility, block, search, outsider, clear, anonymous denial' as result,
 not exists(select 1 from auth.users where id in ('f1200000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000002','f1200000-0000-4000-8000-000000000003')) as rollback_clean;
