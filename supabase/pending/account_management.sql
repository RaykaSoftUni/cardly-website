-- NOT APPLIED: first inspect remote migration history, profiles, existing avatars
-- and Storage policies. Apply through the migration tool and save its REAL version
-- under supabase/migrations/ only after the management connection is restored.
begin;
alter table public.profiles add constraint profile_display_name_length
 check (display_name is null or (char_length(display_name) between 1 and 80 and display_name !~ '[[:cntrl:]]' and display_name = btrim(display_name)));
alter table public.profiles add constraint profile_owned_avatar_path
 check (avatar_url is null or avatar_url ~ ('^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'));
-- Retain the existing owner-only profile RLS and the column-level grant of only
-- display_name/avatar_url. No access to identity, timestamps or roles is added.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('avatars','avatars',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy avatar_read_own on storage.objects for select to authenticated
 using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_insert_own on storage.objects for insert to authenticated
 with check (bucket_id='avatars' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'));
create policy avatar_delete_own on storage.objects for delete to authenticated
 using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Immutable uploads: there is deliberately no UPDATE/overwrite policy.
create function public.account_avatar_available() returns boolean
 language sql stable security invoker set search_path='' as $$ select true $$;
revoke all on function public.account_avatar_available() from public,anon;
grant execute on function public.account_avatar_available() to authenticated;
commit;
