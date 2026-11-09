-- NOT APPLIED. Inspect remote migration history and existing data before applying.
-- Save the ACTUAL returned migration version under supabase/migrations afterwards.
-- Replaces the unapplied account_management.sql proposal. Do not apply both.
begin;
create table private.file_storage_rollout (singleton boolean primary key default true check(singleton), enabled boolean not null default false);
insert into private.file_storage_rollout default values;
revoke all on private.file_storage_rollout from public,anon,authenticated;
create table public.user_uploads (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 purpose text not null check(purpose in ('avatar','draft')), draft_id uuid references public.card_drafts(id) on delete set null,
 storage_path text not null unique, state text not null default 'pending' check(state in ('pending','ready','retired')),
 bytes integer, width integer, height integer, created_at timestamptz not null default now(),
 check(bytes is null or bytes between 1 and 10485760), check(width is null or width between 1 and 8000),
 check(height is null or height between 1 and 8000), check(width is null or width::bigint*height<=16000000)
);
alter table public.user_uploads enable row level security;
revoke all on public.user_uploads from public,anon,authenticated;
grant select on public.user_uploads to authenticated;
grant all on public.user_uploads to service_role;
create policy own_upload_records on public.user_uploads for select to authenticated using(user_id=(select auth.uid()));
create index user_uploads_user_idx on public.user_uploads(user_id);
create index user_uploads_draft_idx on public.user_uploads(draft_id);
create table private.user_file_cleanup (
 storage_path text not null, bucket_id text not null default 'user-uploads', user_id uuid not null,
 primary key(bucket_id,storage_path),
 created_at timestamptz not null default now(), attempts integer not null default 0
);
revoke all on private.user_file_cleanup from public,anon,authenticated;
alter table public.profiles add constraint profile_display_name_length
 check(display_name is null or (char_length(display_name) between 1 and 80 and display_name !~ '[[:cntrl:]]' and display_name=btrim(display_name)));
alter table public.card_drafts add column uploaded_image_path text;
alter table public.generated_cards add column uploaded_image_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('user-uploads','user-uploads',false,10485760,array['image/png']);
-- Only decoded, re-encoded PNG bytes produced by the trusted function enter this bucket.
-- There are intentionally no browser INSERT or UPDATE policies; replacement uses a new path.
create policy own_upload_read on storage.objects for select to authenticated using(
 bucket_id='user-uploads' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.user_uploads u where u.storage_path=name and u.user_id=(select auth.uid()) and u.state='ready')
);
create function private.user_file_referenced(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where avatar_url=p_path)
 or exists(select 1 from public.card_drafts where uploaded_image_path=p_path)
 or exists(select 1 from public.generated_cards where uploaded_image_path=p_path);
$$;
create policy own_unused_upload_delete on storage.objects for delete to authenticated using(
 bucket_id='user-uploads' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.user_uploads u where u.storage_path=name and u.user_id=(select auth.uid()) and u.state='retired')
 and not private.user_file_referenced(name)
);
create function public.account_avatar_available() returns boolean
language sql stable security definer set search_path='' as $$ select enabled from private.file_storage_rollout where singleton $$;
create function public.user_file_storage_available() returns boolean
language sql stable security definer set search_path='' as $$ select enabled from private.file_storage_rollout where singleton $$;
create function public.enable_user_file_storage(p_enabled boolean) returns void
language sql security definer set search_path='' as $$ update private.file_storage_rollout set enabled=p_enabled where singleton $$;
create function private.card_supports_photo(p_card_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.card_templates t where t.card_id=p_card_id and t.layout_config->>'design_key'='photo-keepsake'
 and t.layout_config->'photo_upload'='true'::jsonb and t.layout_config->'canvas'='{"width":600,"height":800}'::jsonb
 and exists(select 1 from public.personalization_fields f where f.card_id=t.card_id and f.field_key='recipient_photo' and f.field_type='image' and not f.is_required));
$$;
create function public.card_photo_available(p_card_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.user_file_storage_available() and private.card_is_usable(p_card_id) and private.card_supports_photo(p_card_id);
$$;
create function public.prepare_user_upload(p_purpose text,p_draft_id uuid default null) returns public.user_uploads
language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_user(); rid uuid:=gen_random_uuid(); d public.card_drafts; result public.user_uploads;
begin
 if not public.user_file_storage_available() then raise exception 'Private uploads are not enabled' using errcode='22023'; end if;
 -- Serialize reservations per user to enforce the pending-upload limit.
 perform 1 from public.profiles where id=uid for update;
 if (select count(*) from public.user_uploads where user_id=uid and state='pending')>=4 then raise exception 'Too many pending uploads. Try again after cleanup.' using errcode='22023'; end if;
 if p_purpose='draft' then
  select * into d from public.card_drafts where id=p_draft_id and user_id=uid and archived_at is null for update;
  if not found then raise exception 'Draft not found' using errcode='P0002'; end if;
  perform private.lock_usable_card(d.card_id);
  if not private.card_supports_photo(d.card_id) then raise exception 'This card does not support photos' using errcode='22023'; end if;
 elsif p_purpose is distinct from 'avatar' or p_draft_id is not null then raise exception 'Invalid upload purpose' using errcode='22023';
 end if;
 insert into public.user_uploads(id,user_id,purpose,draft_id,storage_path) values(rid,uid,p_purpose,p_draft_id,
 uid::text||case when p_purpose='avatar' then '/avatars/' else '/drafts/'||p_draft_id::text||'/' end||rid::text||'.png') returning * into result;
 return result;
end $$;
create function private.guard_file_reference() returns trigger
language plpgsql security definer set search_path='' as $$
declare path text; owner_id uuid; purpose_value text; draft_value uuid;
begin
 if TG_TABLE_NAME='profiles' then path:=new.avatar_url; owner_id:=new.id; purpose_value:='avatar';
 else path:=new.uploaded_image_path; owner_id:=new.user_id; purpose_value:='draft'; draft_value:=new.id;
 end if;
 if path is null then return new; end if;
 if not exists(select 1 from public.user_uploads u where u.storage_path=path and u.user_id=owner_id and u.purpose=purpose_value
 and u.state='ready' and (purpose_value='avatar' or u.draft_id=draft_value)) then
  raise exception 'A validated image owned by this record is required' using errcode='23514';
 end if;
 return new;
end $$;
-- Existing non-null avatar paths must be audited before installing this trigger.
-- Unchanged legacy paths are tolerated until replaced; new arbitrary paths are rejected.
create trigger guard_avatar_reference before insert or update of avatar_url on public.profiles for each row
 when(new.avatar_url is not null) execute function private.guard_file_reference();
create trigger guard_draft_photo_reference before insert or update of uploaded_image_path on public.card_drafts for each row
 execute function private.guard_file_reference();
create function private.retire_user_file(p_path text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_path is null or private.user_file_referenced(p_path) then return; end if;
 update public.user_uploads set state='retired' where storage_path=p_path;
 insert into private.user_file_cleanup(storage_path,user_id) select storage_path,user_id from public.user_uploads where storage_path=p_path on conflict do nothing;
end $$;
create function private.queue_replaced_user_file() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='profiles' then
  if TG_OP='DELETE' or old.avatar_url is distinct from new.avatar_url then perform private.retire_user_file(old.avatar_url); end if;
 else
  if TG_OP='DELETE' or old.uploaded_image_path is distinct from new.uploaded_image_path then perform private.retire_user_file(old.uploaded_image_path); end if;
  if TG_TABLE_NAME='generated_cards' and TG_OP='DELETE' then
   if old.output_image_path is not null and split_part(old.output_image_path,'/',1)=old.user_id::text then
    insert into private.user_file_cleanup(storage_path,bucket_id,user_id) values(old.output_image_path,'user-generated-cards',old.user_id) on conflict do nothing;
   end if;
  end if;
 end if;
 return null;
end $$;
create trigger queue_old_avatar after update of avatar_url or delete on public.profiles for each row execute function private.queue_replaced_user_file();
create trigger queue_old_draft_photo after update of uploaded_image_path or delete on public.card_drafts for each row execute function private.queue_replaced_user_file();
create trigger queue_old_generation_photo after delete on public.generated_cards for each row execute function private.queue_replaced_user_file();
create function public.finish_user_upload(p_id uuid,p_bytes integer,p_width integer,p_height integer) returns public.user_uploads
language plpgsql security definer set search_path='' as $$
declare u public.user_uploads; d public.card_drafts;
begin
 -- Worker only: values are supplied after decoding/re-encoding, never from browser JSON.
 select * into u from public.user_uploads where id=p_id for update;
 if not found or u.state<>'pending' then raise exception 'Upload is not pending' using errcode='22023'; end if;
 if p_width is null or p_height is null or p_bytes is null or p_width not between 1 and 8000 or p_height not between 1 and 8000
 or p_width::bigint*p_height>16000000 or p_bytes not between 1 and 10485760 then raise exception 'Invalid validated image' using errcode='22023'; end if;
 if not exists(select 1 from storage.objects where bucket_id='user-uploads' and name=u.storage_path
 and metadata->>'mimetype'='image/png' and (metadata->>'size')::bigint=p_bytes) then raise exception 'Validated PNG object missing' using errcode='22023'; end if;
 update public.user_uploads set state='ready',bytes=p_bytes,width=p_width,height=p_height where id=u.id returning * into u;
 if u.purpose='avatar' then
  update public.profiles set avatar_url=u.storage_path where id=u.user_id;
  if not found then raise exception 'Profile missing' using errcode='P0002'; end if;
 else
  select * into d from public.card_drafts where id=u.draft_id and user_id=u.user_id and archived_at is null for update;
  if not found then raise exception 'Draft not found' using errcode='P0002'; end if;
  perform private.lock_usable_card(d.card_id);
  if not private.card_supports_photo(d.card_id) then raise exception 'This card does not support photos' using errcode='22023'; end if;
  update public.card_drafts set uploaded_image_path=u.storage_path where id=d.id;
 end if;
 return u;
end $$;
create function public.remove_user_file(p_purpose text,p_draft_id uuid default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_user();
begin
 if p_purpose='avatar' and p_draft_id is null then update public.profiles set avatar_url=null where id=uid;
 elsif p_purpose='draft' then update public.card_drafts set uploaded_image_path=null where id=p_draft_id and user_id=uid;
 else raise exception 'Invalid upload purpose' using errcode='22023'; end if;
 if not found then raise exception 'Record not found' using errcode='P0002'; end if;
 return true;
end $$;
create function public.abort_user_upload(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin perform private.retire_user_file(storage_path) from public.user_uploads where id=p_id and state='pending'; end $$;
create function private.capture_generation_photo() returns trigger
language plpgsql security definer set search_path='' as $$
declare d public.card_drafts;
begin
 if TG_OP='UPDATE' then
  if new.uploaded_image_path is distinct from old.uploaded_image_path then raise exception 'Generation photo is immutable' using errcode='23514'; end if;
  return new;
 end if;
 new.uploaded_image_path:=null;
 if new.source_draft_id is not null then
  select * into d from public.card_drafts where id=new.source_draft_id and user_id=new.user_id and card_id=new.card_id for share;
  if not found then raise exception 'Owned source draft required' using errcode='23514'; end if;
  if d.uploaded_image_path is not null and not private.card_supports_photo(d.card_id) then raise exception 'This card no longer supports photos' using errcode='22023'; end if;
  new.uploaded_image_path:=d.uploaded_image_path;
 end if;
 return new;
end $$;
create trigger capture_generation_photo before insert or update on public.generated_cards for each row execute function private.capture_generation_photo();
create or replace function public.delete_card_draft(p_draft_id uuid,p_archive boolean default true) returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_user();
begin
 if p_archive is null then raise exception 'Archive flag is required' using errcode='22023'; end if;
 if p_archive then update public.card_drafts set archived_at=now(),uploaded_image_path=null where id=p_draft_id and user_id=uid;
 else delete from public.card_drafts where id=p_draft_id and user_id=uid; end if;
 if not found then raise exception 'Draft not found' using errcode='P0002'; end if;
 return true;
end $$;
-- Survives auth/profile/draft cascades. Storage bytes are deleted through its API, never SQL.
create function private.queue_deleted_upload() returns trigger
language plpgsql security definer set search_path='' as $$
begin insert into private.user_file_cleanup(storage_path,user_id) values(old.storage_path,old.user_id) on conflict do nothing; return old; end $$;
create trigger queue_deleted_upload before delete on public.user_uploads for each row execute function private.queue_deleted_upload();
create function public.pending_user_file_cleanup(p_user_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 update public.user_uploads set state='retired' where state='pending' and created_at<now()-interval '1 hour' and (p_user_id is null or user_id=p_user_id);
 insert into private.user_file_cleanup(storage_path,user_id) select storage_path,user_id from public.user_uploads where state='retired' on conflict do nothing;
 return (select coalesce(jsonb_agg(to_jsonb(jobs)),'[]'::jsonb) from (select q.* from private.user_file_cleanup q where (p_user_id is null or q.user_id=p_user_id) and not case when q.bucket_id='user-uploads' then private.user_file_referenced(q.storage_path) else exists(select 1 from public.generated_cards where output_image_path=q.storage_path or output_pdf_path=q.storage_path) end order by q.created_at limit 100) jobs);
end $$;
create function public.confirm_user_file_cleanup(p_path text,p_bucket text default 'user-uploads') returns void
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from storage.objects where bucket_id=p_bucket and name=p_path) then raise exception 'Delete Storage bytes first' using errcode='22023'; end if;
 if p_bucket='user-uploads' then delete from public.user_uploads where storage_path=p_path and state='retired'; end if;
 delete from private.user_file_cleanup where storage_path=p_path and bucket_id=p_bucket;
end $$;
-- Never expose trusted upload finalization or cleanup through ordinary authenticated roles.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.proname in ('user_file_referenced','card_supports_photo','guard_file_reference','retire_user_file','queue_replaced_user_file','capture_generation_photo','queue_deleted_upload')
 or n.nspname='public' and p.proname in ('account_avatar_available','user_file_storage_available','enable_user_file_storage','card_photo_available','prepare_user_upload','finish_user_upload','remove_user_file','abort_user_upload','pending_user_file_cleanup','confirm_user_file_cleanup')
 loop execute format('revoke all on function %s from public,anon,authenticated',f.signature); end loop;
end $$;
grant execute on function private.user_file_referenced(text) to authenticated;
grant execute on function public.card_photo_available(uuid) to anon,authenticated;
grant execute on function public.account_avatar_available(),public.user_file_storage_available(),public.prepare_user_upload(text,uuid),public.remove_user_file(text,uuid) to authenticated;
grant execute on function public.enable_user_file_storage(boolean),public.finish_user_upload(uuid,integer,integer,integer),public.abort_user_upload(uuid),public.pending_user_file_cleanup(uuid),public.confirm_user_file_cleanup(text,text) to service_role;

create or replace function private.validate_field_config() returns trigger
language plpgsql set search_path = '' as $$
declare k text; n numeric; item jsonb;
begin
 if new.field_key !~ '^[a-z][a-z0-9_]{0,63}$' then
  raise exception 'Invalid field key' using errcode = '22023';
 end if;
 if new.field_type = 'image' then
  if new.field_key<>'recipient_photo' or new.is_required or coalesce(new.config,'{}'::jsonb)<>'{}'::jsonb then
   raise exception 'Use the optional recipient_photo image field with empty configuration' using errcode='22023';
  end if;
  return new;
 end if;
 for k in select jsonb_object_keys(coalesce(new.config,'{}')) loop
  if k not in ('min_length','max_length','min','max','options') then
   raise exception 'Unsupported field configuration key: %',k using errcode = '22023';
  end if;
  if k in ('min_length','max_length') then
   if new.field_type not in ('text','textarea') or jsonb_typeof(new.config->k) <> 'number' then
    raise exception 'Invalid length configuration' using errcode = '22023';
   end if;
   n := (new.config->>k)::numeric;
   if n < 0 or n > 10000 or n <> trunc(n) then raise exception 'Length must be an integer from 0 to 10000' using errcode = '22023'; end if;
  elsif k in ('min','max') then
   if new.field_type <> 'number' or jsonb_typeof(new.config->k) <> 'number' then raise exception 'Invalid numeric configuration' using errcode = '22023'; end if;
  elsif new.field_type <> 'select' then
   raise exception 'Options require a select field' using errcode = '22023';
  end if;
 end loop;
 if coalesce((new.config->>'min_length')::integer,0) > coalesce((new.config->>'max_length')::integer,1000) then
  raise exception 'Invalid length range' using errcode = '22023';
 end if;
 if (new.config->>'min')::numeric > (new.config->>'max')::numeric then raise exception 'Invalid numeric range' using errcode = '22023'; end if;
 if new.field_type = 'select' then
  if jsonb_typeof(new.config->'options') is distinct from 'array' or jsonb_array_length(new.config->'options') not between 1 and 100 then
   raise exception 'Select options must contain 1 to 100 strings' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(new.config->'options') loop
   if jsonb_typeof(item) <> 'string' or char_length(item #>> '{}') not between 1 and 1000 then
    raise exception 'Invalid select option' using errcode = '22023';
   end if;
  end loop;
 end if;
 return new;
end $$;
create or replace function private.validate_personalization(p_card_id uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare f public.personalization_fields; k text; v jsonb; txt text; n numeric;
begin
 if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 65536 then
  raise exception 'Personalization must be an object of at most 64 KiB' using errcode = '22023';
 end if;
 for k in select jsonb_object_keys(p_data) loop
  if exists(select 1 from public.personalization_fields where card_id=p_card_id and field_key=k and field_type='image') then
   raise exception 'Attach photos through the private upload endpoint' using errcode='22023';
  end if;
  if not exists (select 1 from public.personalization_fields where card_id = p_card_id and field_key = k) then
   raise exception 'Unknown personalization field: %',k using errcode = '22023';
  end if;
 end loop;
 for f in select * from public.personalization_fields where card_id = p_card_id order by sort_order,field_key loop
  if f.field_type='image' then continue; end if;
  v := p_data->f.field_key;
  if v is null or v = 'null'::jsonb then
   if f.is_required then raise exception 'Required field: %',f.field_key using errcode = '22023'; end if;
   continue;
  end if;
  if f.field_type in ('text','textarea','select') then
   if jsonb_typeof(v) <> 'string' then raise exception 'Text required: %',f.field_key using errcode = '22023'; end if;
   txt := v #>> '{}';
   if (f.is_required and btrim(txt) = '') or char_length(txt) > coalesce((f.config->>'max_length')::integer,1000)
     or char_length(txt) < coalesce((f.config->>'min_length')::integer,0) then
    raise exception 'Invalid text length: %',f.field_key using errcode = '22023';
   end if;
   if f.field_type = 'select' and not coalesce((f.config->'options') @> jsonb_build_array(txt),false) then
    raise exception 'Unsupported value: %',f.field_key using errcode = '22023';
   end if;
  elsif f.field_type = 'number' then
   if jsonb_typeof(v) <> 'number' then raise exception 'Number required: %',f.field_key using errcode = '22023'; end if;
   n := (v #>> '{}')::numeric;
   if n < (f.config->>'min')::numeric or n > (f.config->>'max')::numeric then
    raise exception 'Number out of range: %',f.field_key using errcode = '22023';
   end if;
  else
   raise exception 'Unsupported personalization type: %',f.field_type using errcode = '22023';
  end if;
 end loop;
 return p_data;
end $$;
notify pgrst,'reload schema';
commit;
