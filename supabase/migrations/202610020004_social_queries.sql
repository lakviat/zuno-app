begin;
create function zuno_private.person_json(p public.zuno_profiles) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('user',jsonb_build_object('id',p.user_id,'createdAt',p.created_at),
 'profile',jsonb_build_object('userId',p.user_id,'displayName',p.display_name,'username',p.username,'bio',p.bio,'avatar',coalesce(p.avatar_path,''),'color','#FF6857'),
 'presence',jsonb_build_object('userId',p.user_id,'kind','recent','status',p.status,'emoji','☀️','updatedAt',p.updated_at,'freeNow',p.availability='free' and p.available_until>now(),'availability',p.availability,'intent',p.intent,'availableUntil',p.available_until));
$$;
create function public.zuno_search_people(query text) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); q text:=lower(trim(query)); result jsonb; begin
 if length(q)<3 or length(q)>40 then return '[]'; end if;
 -- Only exact usernames are globally searchable. Names are limited to existing relationships.
 select coalesce(jsonb_agg(zuno_private.person_json(p)),'[]') into result from
 (select p.* from public.zuno_profiles p where p.user_id<>u and not zuno_private.blocked(p.user_id,u) and
 (p.username=q or (zuno_private.profile_visible(p.user_id,u) and (lower(p.display_name) like replace(replace(q,'%','\%'),'_','\_')||'%' or p.username like replace(replace(q,'%','\%'),'_','\_')||'%'))) order by p.username limit 20) p;
 return result; end;
$$;
create function public.zuno_social_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); event_ids uuid[]; chat_ids uuid[]; person_ids uuid[]; result jsonb; nearby jsonb:=public.zuno_nearby_locations(); begin
 select coalesce(array_agg(id),'{}'::uuid[]) into event_ids from (
 select e.id from public.zuno_events e where zuno_private.event_visible(e.id,u) and (
 e.host_id=u or exists(select 1 from public.zuno_event_members m where m.event_id=e.id and m.user_id=u)
 or exists(select 1 from public.zuno_event_invites i where i.event_id=e.id and i.user_id=u)
 or (e.ends_at>now() and e.status='scheduled' and exists(select 1 from zuno_private.map_watches w where w.user_id=u and w.expires_at>now() and extensions.st_dwithin(e.location,w.center,w.radius_m))))
 order by e.ends_at desc limit 100) v;
 select coalesce(array_agg(id),'{}'::uuid[]) into chat_ids from (select c.id from public.zuno_conversations c where zuno_private.chat_visible(c.id,u) and (c.event_id is null or c.event_id=any(event_ids)) order by c.created_at desc limit 50) v;
 select coalesce(array_agg(distinct id),'{}'::uuid[]) into person_ids from (
 select u id union select requester_id from public.zuno_friendships where addressee_id=u and status<>'rejected'
 union select addressee_id from public.zuno_friendships where requester_id=u and status<>'rejected'
 union select user_id from public.zuno_conversation_members where conversation_id=any(chat_ids)
 union select host_id from public.zuno_events where id=any(event_ids)
 union select user_id from public.zuno_event_members where event_id=any(event_ids)
 union select (v->>'userId')::uuid from jsonb_array_elements(nearby) v
 ) v;
 result:=jsonb_build_object('version',2,'currentUserId',u,'theme','system','notifications','[]'::jsonb,'reports','[]'::jsonb,
 'people',coalesce((select jsonb_agg(zuno_private.person_json(p)) from public.zuno_profiles p where p.user_id=any(person_ids) and not zuno_private.blocked(p.user_id,u)),'[]'::jsonb),
 'friendships',coalesce((select jsonb_agg(jsonb_build_object('id',id,'requesterId',requester_id,'addresseeId',addressee_id,'status',status,'createdAt',created_at)) from public.zuno_friendships where u in(requester_id,addressee_id) and status<>'rejected'),'[]'::jsonb),
 'blocks',coalesce((select jsonb_agg(jsonb_build_object('blockerId',blocker_id,'blockedId',blocked_id,'createdAt',created_at)) from public.zuno_blocks where blocker_id=u),'[]'::jsonb),
 'meetups',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'hostId',e.host_id,'title',e.title,'description',e.description,'emoji',e.emoji,'place',e.place,'startsAt',e.starts_at,'endsAt',e.ends_at,'visibility',e.visibility,
 'invitedUserIds',coalesce((select jsonb_agg(user_id) from public.zuno_event_invites where event_id=e.id),'[]'::jsonb),
 'participantIds',coalesce((select jsonb_agg(user_id) from public.zuno_event_members where event_id=e.id and not zuno_private.blocked(user_id,u)),'[]'::jsonb),'capacity',e.capacity,'status',e.status,'createdAt',e.created_at,'updatedAt',e.updated_at)) from public.zuno_events e where e.id=any(event_ids)),'[]'::jsonb),
 'conversations',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'meetupId',c.event_id,
 'participantIds',(select jsonb_agg(user_id) from public.zuno_conversation_members where conversation_id=c.id and not zuno_private.blocked(user_id,u)),
 'unreadCount',(select count(*) from public.zuno_messages m join public.zuno_conversation_members cm on cm.conversation_id=m.conversation_id and cm.user_id=u where m.conversation_id=c.id and m.sender_id<>u and m.created_at>cm.read_at and not zuno_private.blocked(m.sender_id,u)))) from public.zuno_conversations c where c.id=any(chat_ids)),'[]'::jsonb),
 'messages',coalesce((select jsonb_agg(v.item order by v.created_at) from unnest(chat_ids) c cross join lateral (
 select jsonb_build_object('id',m.id,'conversationId',m.conversation_id,'senderId',m.sender_id,'text',m.text,'createdAt',m.created_at,'state','sent','kind','text') item,m.created_at
 from public.zuno_messages m where m.conversation_id=c and not zuno_private.blocked(m.sender_id,u) order by m.created_at desc,m.id desc limit 100) v),'[]'::jsonb),
 'privacy',(select jsonb_build_object('mode',case when visibility='private' then 'hidden' else location_precision end,'ghostMode',visibility='private','showSpeed',show_speed,'showHeading',show_heading) from public.zuno_user_privacy where user_id=u),
 'discovery',(select jsonb_build_object('optedIn',visibility='public','mode',case when visibility='private' then 'hidden' else visibility end,'interests','[]'::jsonb,'units',units) from public.zuno_user_privacy where user_id=u),
 'locations',nearby,
 'blockedPeople',coalesce((select jsonb_agg(jsonb_build_object('id',blocked_id,'label','Blocked account')) from public.zuno_blocks where blocker_id=u),'[]'::jsonb));
 return result; end;
$$;
create function public.zuno_message_history(conversation_id uuid,before_time timestamptz default now(),before_id uuid default 'ffffffff-ffff-ffff-ffff-ffffffffffff') returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); result jsonb; begin
 if not zuno_private.chat_visible(conversation_id,u) then raise exception 'Conversation unavailable'; end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at),'[]') into result from
 (select * from public.zuno_messages m where m.conversation_id=zuno_message_history.conversation_id and (m.created_at,m.id)<(before_time,before_id) and not zuno_private.blocked(m.sender_id,u) order by m.created_at desc,m.id desc limit 100) m;
 return result; end;
$$;
revoke all on function zuno_private.person_json(public.zuno_profiles) from public,anon,authenticated;
revoke all on function public.zuno_search_people(text),public.zuno_social_snapshot(),public.zuno_message_history(uuid,timestamptz,uuid) from public,anon;
grant execute on function public.zuno_search_people(text),public.zuno_social_snapshot(),public.zuno_message_history(uuid,timestamptz,uuid) to authenticated;
commit;
