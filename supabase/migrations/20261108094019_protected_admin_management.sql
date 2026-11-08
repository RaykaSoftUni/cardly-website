-- Authorized administrative operations. Browser roles never receive auth-table grants.
create function private.require_admin() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=private.require_user();
begin
 if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 return uid;
end $$;
create function public.admin_list_users(p_limit integer default 50,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_admin();
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset<0 then raise exception 'Invalid pagination' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at,t.id),'[]') into result from (
 select u.id,u.email,p.display_name,u.created_at,r.role from auth.users u
 left join public.profiles p on p.id=u.id left join public.user_roles r on r.user_id=u.id order by u.created_at,u.id limit p_limit offset p_offset)t;
 return result;
end $$;
create function public.admin_generated_metadata(p_limit integer default 50,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_admin();
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset<0 then raise exception 'Invalid pagination' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id),'[]') into result from (
 select g.id,g.user_id,g.card_id,g.template_id,g.template_version,g.status,g.created_at,g.updated_at,
 g.card_snapshot->>'title' as card_title,g.card_snapshot->>'pricing_type' as pricing_type,g.card_snapshot->>'currency' as currency
 from public.generated_cards g order by g.created_at desc,g.id limit p_limit offset p_offset)t;
 return result;
end $$;
create function public.admin_set_user_role(p_user_id uuid,p_role text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 -- Serialize role edits and recheck authorization after obtaining the lock.
 lock table public.user_roles in share row exclusive mode;
 uid:=private.require_admin();
 if p_user_id=uid then raise exception 'You cannot change your own role' using errcode='42501'; end if;
 if p_role is null or p_role not in ('user','admin') then raise exception 'Invalid role' using errcode='22023'; end if;
 update public.user_roles set role=p_role where user_id=p_user_id;
 if not found then raise exception 'User not found' using errcode='P0002'; end if;
 return jsonb_build_object('user_id',p_user_id,'role',p_role);
end $$;
create function public.admin_remove_configuration(p_entity text,p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 perform private.require_admin();
 if p_entity not in ('card_images','personalization_fields') or p_entity is null then raise exception 'Unsupported removal' using errcode='22023'; end if;
 execute format('delete from public.%I where id=$1',p_entity) using p_id;
 get diagnostics affected=row_count;
 if affected=0 then raise exception 'Configuration not found' using errcode='P0002'; end if;
 return true;
end $$;
create function public.admin_reorder_fields(p_card_id uuid,p_field_ids uuid[]) returns boolean
language plpgsql security definer set search_path='' as $$
declare count_fields integer;
begin
 perform private.require_admin();
 perform 1 from public.cards where id=p_card_id for update;
 if not found then raise exception 'Card not found' using errcode='P0002'; end if;
 select count(*) into count_fields from public.personalization_fields where card_id=p_card_id;
 if p_field_ids is null or cardinality(p_field_ids)<>count_fields
 or (select count(distinct id) from unnest(p_field_ids)id)<>count_fields
 or exists(select 1 from unnest(p_field_ids) id where not exists(select 1 from public.personalization_fields f where f.id=id and f.card_id=p_card_id)) then
 raise exception 'Supply each card field exactly once' using errcode='22023'; end if;
 update public.personalization_fields f set sort_order=t.ordinality-1 from unnest(p_field_ids) with ordinality t(id,ordinality) where f.id=t.id and f.card_id=p_card_id;
 return true;
end $$;

alter table public.cards add constraint card_required_text check (btrim(title)<>'' and btrim(slug)<>'');
alter table public.categories add constraint category_required_text check (btrim(name)<>'' and btrim(slug)<>'');
alter table public.occasions add constraint occasion_required_text check (btrim(name)<>'' and btrim(slug)<>'');
alter table public.personalization_fields add constraint field_required_label check (btrim(label)<>'');
alter table public.card_templates add constraint template_required_key check (btrim(template_key)<>'');
alter table public.card_images add constraint public_image_alt_required check (image_type not in ('thumbnail','preview') or btrim(coalesce(alt_text,''))<>'');

-- Optional layout regions reference catalog assets, not unvalidated user photos.
create function private.validate_layout_regions() returns trigger
language plpgsql set search_path='' as $$
declare region jsonb; collection text; key text;
begin
 foreach collection in array array['regions','image_regions'] loop
  if new.layout_config ? collection then
   if jsonb_typeof(new.layout_config->collection)<>'array' then raise exception 'Layout regions must be arrays' using errcode='22023'; end if;
   if jsonb_array_length(new.layout_config->collection)>100 then raise exception 'Too many layout regions' using errcode='22023'; end if;
   for region in select value from jsonb_array_elements(new.layout_config->collection) loop
    if jsonb_typeof(region)<>'object' then raise exception 'Each layout region must be an object' using errcode='22023'; end if;
    if collection='regions' and region ? 'field' and coalesce(region->>'field','') !~ '^[a-z][a-z0-9_]{0,63}$' then raise exception 'Invalid dynamic field key' using errcode='22023'; end if;
    foreach key in array array['x','y','width','height'] loop
     if region ? key and (jsonb_typeof(region->key)<>'number' or not (region->>key)::numeric between 0 and 10000) then
      raise exception 'Region coordinates must be numeric from 0 to 10000' using errcode='22023';
     end if;
    end loop;
    if collection='image_regions' and region ? 'storage_path' and coalesce(region->>'storage_path','') ~ '(^/|://|\.\.)' then
     raise exception 'Use a relative catalog Storage path' using errcode='22023';
    end if;
   end loop;
  end if;
 end loop;
 return new;
end $$;
create trigger validate_layout_regions before insert or update on public.card_templates for each row execute function private.validate_layout_regions();

-- Never overwrite old object paths: new uploads use UUID filenames. Deletion
-- is allowed only after associations are removed and historical references checked.
create function private.asset_is_referenced(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.card_images where storage_path=p_path)
 or exists(select 1 from public.card_templates where strpos(layout_config::text,to_jsonb(p_path)::text)>0 or strpos(style_config::text,to_jsonb(p_path)::text)>0)
 or exists(select 1 from public.card_template_versions where strpos(layout_config::text,to_jsonb(p_path)::text)>0 or strpos(style_config::text,to_jsonb(p_path)::text)>0)
 or exists(select 1 from public.generated_cards where strpos(template_snapshot::text,to_jsonb(p_path)::text)>0);
$$;
drop policy card_asset_update on storage.objects;
drop policy card_asset_delete on storage.objects;
create policy card_asset_delete on storage.objects for delete to authenticated using (
 bucket_id='card-assets' and (select private.is_admin()) and not private.asset_is_referenced(name)
);
update storage.buckets set allowed_mime_types=array['image/png','image/jpeg','image/webp'],file_size_limit=5242880 where id='card-assets';

-- Keep the complete asset manifest on future snapshots, without rewriting old rows.
create or replace function private.snapshot_generation() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.cards; t public.card_templates;
begin
 if TG_OP='UPDATE' then
  if new.card_snapshot is distinct from old.card_snapshot or new.template_snapshot is distinct from old.template_snapshot
  or new.template_id is distinct from old.template_id or new.template_version is distinct from old.template_version
  or new.personalization_data is distinct from old.personalization_data then
   raise exception 'Generation snapshots are immutable' using errcode='23514';
  end if;
  return new;
 end if;
 c:=private.lock_usable_card(new.card_id);
 new.personalization_data:=private.validate_personalization(new.card_id,new.personalization_data);
 select * into t from public.card_templates where card_id=c.id;
 if not found then raise exception 'Card has no template' using errcode='22023'; end if;
 new.card_snapshot:=jsonb_build_object('id',c.id,'title',c.title,'slug',c.slug,'pricing_type',c.pricing_type,'price',coalesce(c.price,0),'currency',c.currency);
 new.template_id:=t.id;new.template_version:=t.version;
 new.template_snapshot:=jsonb_build_object('id',t.id,'template_key',t.template_key,'version',t.version,'layout_config',t.layout_config,'style_config',t.style_config,
 'assets',coalesce((select jsonb_agg(jsonb_build_object('storage_path',storage_path,'alt_text',alt_text,'image_type',image_type) order by sort_order,id) from public.card_images where card_id=c.id),'[]'::jsonb));
 return new;
end $$;
-- Serialize image changes with the generation snapshot just like fields/templates.
create trigger lock_card_configuration before insert or update or delete on public.card_images for each row execute function private.lock_card_configuration();

revoke all on function private.require_admin(),private.validate_layout_regions(),private.asset_is_referenced(text) from public,anon,authenticated;
grant execute on function private.asset_is_referenced(text) to authenticated;
revoke all on function public.admin_list_users(integer,integer),public.admin_generated_metadata(integer,integer),public.admin_set_user_role(uuid,text),public.admin_remove_configuration(text,uuid),public.admin_reorder_fields(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.admin_list_users(integer,integer),public.admin_generated_metadata(integer,integer),public.admin_set_user_role(uuid,text),public.admin_remove_configuration(text,uuid),public.admin_reorder_fields(uuid,uuid[]) to authenticated;
notify pgrst,'reload schema';
