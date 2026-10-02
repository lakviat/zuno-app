begin;
create function public.zuno_save_profile(display_name text,bio text default '',username text default null,avatar_path text default null,status text default '',availability text default 'busy',intent text default '') returns void language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); begin
 if avatar_path is not null and split_part(avatar_path,'/',1)<>u::text then raise exception 'Invalid avatar owner'; end if;
 insert into public.zuno_profiles(user_id,display_name,bio,username,avatar_path,status,availability,intent,available_until)
 values(u,trim(display_name),trim(bio),coalesce(nullif(lower(trim(username)),''),'user_'||replace(u::text,'-','')),avatar_path,status,availability,intent,now()+interval '2 hours')
 on conflict(user_id) do update set display_name=excluded.display_name,bio=excluded.bio,
 username=coalesce(nullif(lower(trim(zuno_save_profile.username)),''),zuno_profiles.username),
 avatar_path=coalesce(zuno_save_profile.avatar_path,zuno_profiles.avatar_path),status=excluded.status,availability=excluded.availability,intent=excluded.intent,available_until=excluded.available_until;
 insert into public.zuno_user_privacy(user_id) values(u) on conflict do nothing;
 perform zuno_private.notify_user(u,'sync'); end;
$$;
create function public.zuno_bootstrap() returns void language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); begin
 insert into public.zuno_profiles(user_id,display_name,username) values(u,'New friend','user_'||replace(u::text,'-','')) on conflict do nothing;
 insert into public.zuno_user_privacy(user_id) values(u) on conflict do nothing;
 end;
$$;
create function public.zuno_friend_action(peer uuid,operation text) returns void language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); f public.zuno_friendships; begin
 if peer is null or peer=u or not exists(select 1 from public.zuno_profiles where user_id=peer) then raise exception 'Person unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(u,peer)::text||greatest(u,peer)::text,2));
 if operation='unblock' then delete from public.zuno_blocks where blocker_id=u and blocked_id=peer;
 elsif operation='block' then
 perform pg_advisory_xact_lock(hashtextextended(least(u,peer)::text,1));
 perform pg_advisory_xact_lock(hashtextextended(greatest(u,peer)::text,1));
 insert into public.zuno_blocks(blocker_id,blocked_id) values(u,peer) on conflict do nothing;
 delete from public.zuno_friendships where least(requester_id,addressee_id)=least(u,peer) and greatest(requester_id,addressee_id)=greatest(u,peer);
 delete from public.zuno_event_members m using public.zuno_events e where m.event_id=e.id and ((e.host_id=u and m.user_id=peer) or (e.host_id=peer and m.user_id=u));
 delete from public.zuno_conversation_members m using public.zuno_conversations c,public.zuno_events e where m.conversation_id=c.id and c.event_id=e.id and ((e.host_id=u and m.user_id=peer) or (e.host_id=peer and m.user_id=u));
 perform zuno_private.notify_user(u,'location_removed',jsonb_build_object('userId',peer));
 perform zuno_private.notify_user(peer,'location_removed',jsonb_build_object('userId',u));
 elsif zuno_private.blocked(u,peer) then raise exception 'Person unavailable';
 elsif operation='add' then
 insert into public.zuno_friendships(requester_id,addressee_id) values(u,peer) on conflict (least(requester_id,addressee_id),greatest(requester_id,addressee_id))
 do update set requester_id=excluded.requester_id,addressee_id=excluded.addressee_id,status='pending',created_at=now() where zuno_friendships.status='rejected';
 elsif operation='accept' then
 update public.zuno_friendships set status='accepted' where requester_id=peer and addressee_id=u and status='pending';
 if not found then raise exception 'Request unavailable'; end if;
 elsif operation='remove' then
 delete from public.zuno_friendships where least(requester_id,addressee_id)=least(u,peer) and greatest(requester_id,addressee_id)=greatest(u,peer);
 perform zuno_private.notify_user(u,'location_removed',jsonb_build_object('userId',peer));
 perform zuno_private.notify_user(peer,'location_removed',jsonb_build_object('userId',u));
 else raise exception 'Invalid friendship action'; end if;
 perform zuno_private.notify_user(u,'sync'); perform zuno_private.notify_user(peer,'sync');
 end;
$$;
create function public.zuno_event_action(operation text,event_id uuid default null,draft jsonb default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); e public.zuno_events; eid uuid:=coalesce(event_id,gen_random_uuid()); cid uuid; r uuid; place jsonb; point extensions.geography; start_time timestamptz; end_time timestamptz; invite_ids uuid[]; member_count int; begin
 if operation in ('create','edit') then
 place:=draft->'place';
 if place is null or length(trim(coalesce(place->>'name','')))=0 or length(place->>'name')>120 or length(coalesce(place->>'area',''))>120 or length(coalesce(place->>'areaId',''))>120 or coalesce(place->>'precision','') not in ('precise','approximate') or coalesce(place->>'kind','') not in ('map-pin','area','public-venue') then raise exception 'Choose a valid meeting place'; end if;
 point:=zuno_private.point((place->'coordinate'->>'latitude')::double precision,(place->'coordinate'->>'longitude')::double precision);
 start_time:=case when (draft->>'startNow')::boolean then now() else (draft->>'startsAt')::timestamptz end;
 end_time:=(draft->>'endsAt')::timestamptz;
 if end_time<=now() or start_time is null or end_time is null then raise exception 'Choose a future end time'; end if;
 select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into invite_ids from jsonb_array_elements_text(coalesce(draft->'invitedUserIds','[]'));
 if cardinality(invite_ids)>100 or exists(select 1 from unnest(invite_ids) i where not zuno_private.friends(u,i)) then raise exception 'Invite only accepted, unblocked friends'; end if;
 end if;
 if operation='create' then
 if start_time<now()-interval '1 minute' then raise exception 'Choose a future start time'; end if;
 insert into public.zuno_events(id,host_id,title,description,emoji,place,location,starts_at,ends_at,visibility,capacity)
 values(eid,u,trim(draft->>'title'),coalesce(draft->>'description',''),draft->>'emoji',place,point,start_time,end_time,draft->>'visibility',(draft->>'capacity')::integer);
 insert into public.zuno_event_members(event_id,user_id) values(eid,u);
 insert into public.zuno_conversations(event_id) values(eid) returning id into cid;
 insert into public.zuno_conversation_members(conversation_id,user_id) values(cid,u);
 else
 select * into e from public.zuno_events where id=eid for update;
 if not found or not zuno_private.event_visible(eid,u) then raise exception 'Meetup unavailable'; end if;
 select id into cid from public.zuno_conversations where zuno_conversations.event_id=eid;
 if e.status='cancelled' or e.ends_at<=now() then raise exception 'Meetup has ended'; end if;
 if operation in ('edit','cancel') then
 if e.host_id<>u then raise exception 'Only the host can change this meetup'; end if;
 if operation='cancel' then update public.zuno_events set status='cancelled',updated_at=now() where id=eid;
 else
 select count(*) into member_count from public.zuno_event_members where zuno_event_members.event_id=eid;
 if (draft->>'capacity')::integer<member_count then raise exception 'Capacity is below the attendee count'; end if;
 if start_time<now()-interval '1 minute' and date_trunc('minute',start_time)<>date_trunc('minute',e.starts_at) then raise exception 'Choose a future start time'; end if;
 if exists(select 1 from public.zuno_event_members m where m.event_id=eid and m.user_id<>u and
 not ((draft->>'visibility')='public' or ((draft->>'visibility')='friends' and zuno_private.friends(u,m.user_id)) or m.user_id=any(invite_ids))) then raise exception 'Keep existing participants in the audience'; end if;
 update public.zuno_events set title=trim(draft->>'title'),description=coalesce(draft->>'description',''),emoji=draft->>'emoji',place=zuno_event_action.place,location=point,starts_at=start_time,ends_at=end_time,visibility=draft->>'visibility',capacity=(draft->>'capacity')::integer,updated_at=now() where id=eid;
 end if;
 elsif operation='join' then
 if not exists(select 1 from public.zuno_event_members where zuno_event_members.event_id=eid and user_id=u) then
 select count(*) into member_count from public.zuno_event_members where zuno_event_members.event_id=eid;
 if e.capacity is not null and member_count>=e.capacity then raise exception 'Meetup is full'; end if;
 insert into public.zuno_event_members(event_id,user_id) values(eid,u);
 insert into public.zuno_conversation_members(conversation_id,user_id) values(cid,u) on conflict do nothing;
 end if;
 elsif operation='leave' then
 if e.host_id=u then raise exception 'Hosts cancel instead of leaving'; end if;
 delete from public.zuno_event_members where zuno_event_members.event_id=eid and user_id=u;
 delete from public.zuno_conversation_members where conversation_id=cid and user_id=u;
 else raise exception 'Invalid meetup action'; end if;
 end if;
 if operation in ('create','edit') then
 delete from public.zuno_event_invites where zuno_event_invites.event_id=eid;
 insert into public.zuno_event_invites(event_id,user_id) select eid,unnest(invite_ids);
 end if;
 for r in select user_id from public.zuno_event_members where zuno_event_members.event_id=eid union select user_id from public.zuno_event_invites where zuno_event_invites.event_id=eid union select u loop perform zuno_private.notify_user(r,'sync'); end loop;
 return eid; end;
$$;
create function public.zuno_send_message(text text,peer uuid default null,event_id uuid default null,client_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); cid uuid; mid uuid:=coalesce(client_id,gen_random_uuid()); pair text; r uuid; begin
 if (select count(*) from public.zuno_messages where sender_id=u and created_at>now()-interval '1 minute')>=30 then raise exception 'Please wait before sending more messages'; end if;
 if (peer is null)=(event_id is null) then raise exception 'Choose a conversation'; end if;
 if peer is not null then
 if not zuno_private.friends(u,peer) then raise exception 'Add this person as a friend to chat'; end if;
 pair:=least(u,peer)::text||':'||greatest(u,peer)::text;
 insert into public.zuno_conversations(direct_pair) values(pair) on conflict(direct_pair) do update set direct_pair=excluded.direct_pair returning id into cid;
 insert into public.zuno_conversation_members(conversation_id,user_id) values(cid,u),(cid,peer) on conflict do nothing;
 else
 select id into cid from public.zuno_conversations where zuno_conversations.event_id=zuno_send_message.event_id;
 if not zuno_private.chat_visible(cid,u) or not exists(select 1 from public.zuno_events where id=event_id and status='scheduled' and ends_at>now()) then raise exception 'Only current members can send to an active meetup'; end if;
 end if;
 if exists(select 1 from public.zuno_messages where id=mid and (sender_id<>u or conversation_id<>cid)) then raise exception 'Message identifier unavailable'; end if;
 insert into public.zuno_messages(id,conversation_id,sender_id,text) values(mid,cid,u,trim(text)) on conflict(id) do nothing;
 for r in select user_id from public.zuno_conversation_members where conversation_id=cid and not zuno_private.blocked(user_id,u) loop perform zuno_private.notify_user(r,'sync'); end loop;
 return mid; end;
$$;
create function public.zuno_mark_read(conversation_id uuid) returns void language plpgsql security definer set search_path='' as $$
 begin update public.zuno_conversation_members set read_at=now() where zuno_conversation_members.conversation_id=zuno_mark_read.conversation_id and user_id=zuno_private.require_user(); end;
$$;
create function public.zuno_report(subject_id uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
 begin insert into public.zuno_reports(reporter_id,subject_id,reason) values(zuno_private.require_user(),subject_id,trim(reason)); end;
$$;
-- Explicit allowlist: no internal function is a public RPC.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('zuno_save_profile','zuno_bootstrap','zuno_friend_action','zuno_event_action','zuno_send_message','zuno_mark_read','zuno_report') loop
 execute format('revoke all on function %s from public, anon',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop; end $$;
commit;
