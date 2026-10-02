begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('zuno-avatars','zuno-avatars',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy zuno_avatar_owner_insert on storage.objects for insert to authenticated with check(bucket_id='zuno-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy zuno_avatar_owner_update on storage.objects for update to authenticated using(bucket_id='zuno-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='zuno-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy zuno_avatar_owner_delete on storage.objects for delete to authenticated using(bucket_id='zuno-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Avatars are explicitly social profile pictures, but blocks still prevent new reads/URLs.
create function zuno_private.avatar_visible(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.zuno_profiles p where p.avatar_path=path and not zuno_private.blocked(p.user_id,auth.uid()));
$$;
revoke all on function zuno_private.avatar_visible(text) from public,anon;
grant execute on function zuno_private.avatar_visible(text) to authenticated;
create policy zuno_avatar_read on storage.objects for select to authenticated using(bucket_id='zuno-avatars' and zuno_private.avatar_visible(name) or (bucket_id='zuno-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text));
-- Storage objects must be removed through the Storage API before deleting Auth: DB-only
-- object deletion can orphan actual files. The client enforces this preflight.
create or replace function public.zuno_delete_my_account() returns void language plpgsql security definer set search_path='' as $$
 declare u uuid:=zuno_private.require_user(); begin
 if exists(select 1 from storage.objects where bucket_id='zuno-avatars' and (storage.foldername(name))[1]=u::text) then raise exception 'Remove your uploaded photos before deleting your account'; end if;
 delete from public.zuno_conversations c where c.event_id is null and exists(select 1 from public.zuno_conversation_members m where m.conversation_id=c.id and m.user_id=u);
 delete from auth.users where id=u;
 end;
$$;
commit;
