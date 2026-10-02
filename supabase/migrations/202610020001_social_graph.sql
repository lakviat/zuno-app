-- Durable social state. Actor identity always comes from auth.uid().
begin;
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create schema if not exists zuno_private;
revoke all on schema zuno_private from public, anon, authenticated;

alter table public.zuno_profiles add column username text;
alter table public.zuno_profiles add column avatar_path text;
alter table public.zuno_profiles add column status text not null default '' check (length(status) <= 80);
alter table public.zuno_profiles add column availability text not null default 'busy' check (availability in ('free','later','busy'));
alter table public.zuno_profiles add column intent text not null default '' check (length(intent) <= 60);
alter table public.zuno_profiles add column available_until timestamptz;
alter table public.zuno_profiles add column created_at timestamptz not null default now();
update public.zuno_profiles set username = 'user_' || replace(user_id::text, '-', '');
alter table public.zuno_profiles alter column username set not null;
alter table public.zuno_profiles add constraint zuno_username_format check (username ~ '^[a-z0-9_]{3,40}$');
create unique index zuno_profiles_username on public.zuno_profiles(username);

create table public.zuno_user_privacy (
 user_id uuid primary key references auth.users on delete cascade,
 visibility text not null default 'private' check (visibility in ('private','friends','public')),
 location_precision text not null default 'precise' check (location_precision in ('precise','approximate')),
 show_speed boolean not null default false, show_heading boolean not null default false,
 units text not null default 'mph' check (units in ('mph','kmh')),
 updated_at timestamptz not null default now()
);
create table public.zuno_friendships (
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references auth.users on delete cascade,
 addressee_id uuid not null references auth.users on delete cascade,
 status text not null default 'pending' check (status in ('pending','accepted','rejected')),
 created_at timestamptz not null default now(), check (requester_id <> addressee_id)
);
create unique index zuno_friendships_pair on public.zuno_friendships(least(requester_id,addressee_id),greatest(requester_id,addressee_id));
create index zuno_friendships_addressee on public.zuno_friendships(addressee_id,status);
create index zuno_friendships_requester on public.zuno_friendships(requester_id,status);
create table public.zuno_blocks (
 blocker_id uuid not null references auth.users on delete cascade,
 blocked_id uuid not null references auth.users on delete cascade,
 created_at timestamptz not null default now(), primary key(blocker_id,blocked_id), check(blocker_id <> blocked_id)
);
create index zuno_blocks_reverse on public.zuno_blocks(blocked_id,blocker_id);
create table public.zuno_events (
 id uuid primary key default gen_random_uuid(), host_id uuid not null references auth.users on delete cascade,
 title text not null check(length(trim(title)) between 1 and 60),
 description text not null default '' check(length(description) <= 240),
 emoji text not null default '☀️' check(length(emoji) between 1 and 16),
 place jsonb not null, location extensions.geography(Point,4326) not null,
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at > starts_at),
 visibility text not null default 'friends' check(visibility in ('friends','public','invite-only')),
 capacity integer check(capacity between 1 and 1000),
 status text not null default 'scheduled' check(status in ('scheduled','cancelled')),
 image_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index zuno_events_geo on public.zuno_events using gist(location);
create index zuno_events_host on public.zuno_events(host_id,starts_at);
create index zuno_events_time on public.zuno_events(ends_at,starts_at);
create table public.zuno_event_invites (
 event_id uuid references public.zuno_events on delete cascade,
 user_id uuid references auth.users on delete cascade, primary key(event_id,user_id)
);
create index zuno_event_invites_user on public.zuno_event_invites(user_id);
create table public.zuno_event_members (
 event_id uuid references public.zuno_events on delete cascade,
 user_id uuid references auth.users on delete cascade, joined_at timestamptz not null default now(), primary key(event_id,user_id)
);
create index zuno_event_members_user on public.zuno_event_members(user_id);
create table public.zuno_conversations (
 id uuid primary key default gen_random_uuid(), event_id uuid unique references public.zuno_events on delete cascade,
 direct_pair text unique, created_at timestamptz not null default now(),
 check ((event_id is null) <> (direct_pair is null))
);
create table public.zuno_conversation_members (
 conversation_id uuid references public.zuno_conversations on delete cascade,
 user_id uuid references auth.users on delete cascade, read_at timestamptz not null default now(), primary key(conversation_id,user_id)
);
create index zuno_conversation_members_user on public.zuno_conversation_members(user_id);
create table public.zuno_messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.zuno_conversations on delete cascade,
 sender_id uuid not null references auth.users on delete cascade,
 text text not null check(length(trim(text)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index zuno_messages_page on public.zuno_messages(conversation_id,created_at desc,id);
create index zuno_messages_sender on public.zuno_messages(sender_id);
create table public.zuno_reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references auth.users on delete cascade,
 subject_id uuid not null, reason text not null check(length(trim(reason)) between 1 and 500), created_at timestamptz not null default now()
);
create index zuno_reports_reporter on public.zuno_reports(reporter_id,created_at);

create function zuno_private.blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.zuno_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
create function zuno_private.friends(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not zuno_private.blocked(a,b) and exists(select 1 from public.zuno_friendships where status='accepted' and ((requester_id=a and addressee_id=b) or (requester_id=b and addressee_id=a)));
$$;
create function zuno_private.event_visible(e uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select u is not null and exists(select 1 from public.zuno_events v where v.id=e and not zuno_private.blocked(v.host_id,u) and
 (v.host_id=u or v.visibility='public' or (v.visibility='friends' and zuno_private.friends(v.host_id,u)) or exists(select 1 from public.zuno_event_invites i where i.event_id=e and i.user_id=u)));
$$;
create function zuno_private.chat_visible(c uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select u is not null and exists(select 1 from public.zuno_conversation_members where conversation_id=c and user_id=u)
 and exists(select 1 from public.zuno_conversations v where id=c and
 ((event_id is not null and zuno_private.event_visible(event_id,u)) or
 (event_id is null and not exists(select 1 from public.zuno_conversation_members m where m.conversation_id=c and zuno_private.blocked(m.user_id,u)))));
$$;
create function zuno_private.profile_visible(p uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select u is not null and not zuno_private.blocked(p,u) and (p=u or exists(select 1 from public.zuno_friendships where status <> 'rejected' and ((requester_id=p and addressee_id=u) or (requester_id=u and addressee_id=p)))
 or exists(select 1 from public.zuno_conversation_members m where m.user_id=p and zuno_private.chat_visible(m.conversation_id,u)));
$$;
drop policy zuno_profile_read on public.zuno_profiles;
create policy zuno_profile_read on public.zuno_profiles for select to authenticated using(zuno_private.profile_visible(user_id,(select auth.uid())));
-- New profile creation/update goes through bounded RPCs, preserving the owner policies as a second boundary.
revoke insert, update, delete on public.zuno_profiles from authenticated;

do $$ declare t text; begin
 foreach t in array array['zuno_user_privacy','zuno_friendships','zuno_blocks','zuno_events','zuno_event_invites','zuno_event_members','zuno_conversations','zuno_conversation_members','zuno_messages','zuno_reports'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy zuno_privacy_owner on public.zuno_user_privacy for select to authenticated using(user_id=(select auth.uid()));
create policy zuno_friendship_participant on public.zuno_friendships for select to authenticated using((select auth.uid()) in (requester_id,addressee_id));
create policy zuno_blocks_owner on public.zuno_blocks for select to authenticated using(blocker_id=(select auth.uid()));
create policy zuno_events_audience on public.zuno_events for select to authenticated using(zuno_private.event_visible(id,(select auth.uid())));
create policy zuno_invites_audience on public.zuno_event_invites for select to authenticated using(zuno_private.event_visible(event_id,(select auth.uid())));
create policy zuno_members_audience on public.zuno_event_members for select to authenticated using(zuno_private.event_visible(event_id,(select auth.uid())) and not zuno_private.blocked(user_id,(select auth.uid())));
create policy zuno_conversations_member on public.zuno_conversations for select to authenticated using(zuno_private.chat_visible(id,(select auth.uid())));
create policy zuno_chat_members_member on public.zuno_conversation_members for select to authenticated using(zuno_private.chat_visible(conversation_id,(select auth.uid())) and not zuno_private.blocked(user_id,(select auth.uid())));
create policy zuno_messages_member on public.zuno_messages for select to authenticated using(zuno_private.chat_visible(conversation_id,(select auth.uid())) and not zuno_private.blocked(sender_id,(select auth.uid())));
create policy zuno_reports_owner on public.zuno_reports for select to authenticated using(reporter_id=(select auth.uid()));
revoke all on all functions in schema zuno_private from public,anon,authenticated;
-- Policies may call these helpers, but the private schema is not exposed by PostgREST.
grant usage on schema zuno_private to authenticated;
grant execute on function zuno_private.blocked(uuid,uuid),zuno_private.friends(uuid,uuid),zuno_private.event_visible(uuid,uuid),zuno_private.chat_visible(uuid,uuid),zuno_private.profile_visible(uuid,uuid) to authenticated;
commit;
