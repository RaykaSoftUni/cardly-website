-- Public projection RPCs and server-authorized personalization workflow.
alter table public.cards add column style text;
create index cards_style_idx on public.cards(style);
alter table public.card_drafts add column archived_at timestamptz;
alter table public.card_drafts add column template_id uuid;
alter table public.card_drafts add column template_version integer;
alter table public.generated_cards add column card_snapshot jsonb;
alter table public.generated_cards add column template_id uuid;
alter table public.generated_cards add column template_version integer;
alter table public.generated_cards add column template_snapshot jsonb;
alter table public.generated_cards add column error_message text;

create table public.card_template_versions (
 template_id uuid not null references public.card_templates(id) on delete restrict,
 version integer not null check (version > 0),
 template_key text not null,
 layout_config jsonb not null,
 style_config jsonb,
 created_at timestamptz not null default now(),
 primary key(template_id, version)
);
alter table public.card_template_versions enable row level security;
revoke all on public.card_template_versions from public, anon, authenticated;
grant select on public.card_template_versions to authenticated;
grant select, insert on public.card_template_versions to service_role;
create policy admin_version_read on public.card_template_versions for select to authenticated using ((select private.is_admin()));
insert into public.card_template_versions(template_id,version,template_key,layout_config,style_config)
select id,version,template_key,layout_config,style_config from public.card_templates;
alter table public.card_drafts add constraint draft_template_version_fk foreign key(template_id,template_version) references public.card_template_versions(template_id,version);
alter table public.generated_cards add constraint generation_template_version_fk foreign key(template_id,template_version) references public.card_template_versions(template_id,version);
create index draft_template_version_idx on public.card_drafts(template_id,template_version);
create index generation_template_version_idx on public.generated_cards(template_id,template_version);

-- Lock the parent for all template/field mutations so generation sees one configuration.
create function private.lock_card_configuration() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP <> 'INSERT' then
  perform 1 from public.cards where id = old.card_id for update;
 end if;
 if TG_OP <> 'DELETE' then
  if TG_OP = 'UPDATE' and (new.card_id <> old.card_id or new.id <> old.id) then
   raise exception 'Configuration identity is immutable' using errcode = '23514';
  end if;
  perform 1 from public.cards where id = new.card_id for update;
  return new;
 end if;
 return old;
end $$;
create trigger lock_card_configuration before insert or update or delete on public.card_templates
for each row execute function private.lock_card_configuration();
create trigger lock_card_configuration before insert or update or delete on public.personalization_fields
for each row execute function private.lock_card_configuration();

create function private.version_template() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP = 'UPDATE' then
  if new.template_key is distinct from old.template_key or new.layout_config is distinct from old.layout_config
     or new.style_config is distinct from old.style_config then
   new.version := old.version + 1;
  elsif new.version <> old.version then
   raise exception 'Version is managed by template changes' using errcode = '23514';
  end if;
 elsif new.version <> 1 then
  raise exception 'New templates start at version 1' using errcode = '23514';
 end if;
 return new;
end $$;
create trigger version_template before insert or update on public.card_templates
for each row execute function private.version_template();
create function private.capture_template_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.card_template_versions(template_id,version,template_key,layout_config,style_config)
 values (new.id,new.version,new.template_key,new.layout_config,new.style_config)
 on conflict (template_id,version) do nothing;
 return new;
end $$;
create trigger capture_template_version after insert or update on public.card_templates
for each row execute function private.capture_template_version();
create function private.reject_version_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'Historical templates are immutable' using errcode = '23514'; end $$;
create trigger immutable_version before update or delete on public.card_template_versions
for each row execute function private.reject_version_mutation();

create function private.validate_field_config() returns trigger
language plpgsql set search_path = '' as $$
declare k text; n numeric; item jsonb;
begin
 if new.field_key !~ '^[a-z][a-z0-9_]{0,63}$' then
  raise exception 'Invalid field key' using errcode = '22023';
 end if;
 if new.field_type = 'image' then
  raise exception 'Image personalization is not supported until a trusted upload pipeline is implemented' using errcode = '22023';
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
create trigger validate_field_config before insert or update on public.personalization_fields
for each row execute function private.validate_field_config();

create function private.validate_personalization(p_card_id uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare f public.personalization_fields; k text; v jsonb; txt text; n numeric;
begin
 if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 65536 then
  raise exception 'Personalization must be an object of at most 64 KiB' using errcode = '22023';
 end if;
 for k in select jsonb_object_keys(p_data) loop
  if not exists (select 1 from public.personalization_fields where card_id = p_card_id and field_key = k) then
   raise exception 'Unknown personalization field: %',k using errcode = '22023';
  end if;
 end loop;
 for f in select * from public.personalization_fields where card_id = p_card_id order by sort_order,field_key loop
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

create function private.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 return auth.uid();
end $$;
create function private.lock_usable_card(p_card_id uuid) returns public.cards
language plpgsql security definer set search_path = '' as $$
declare c public.cards;
begin
 select * into c from public.cards where id = p_card_id for update;
 if not found then raise exception 'Card is not available' using errcode = '22023'; end if;
 perform 1 from public.categories where id = c.category_id for share;
 perform 1 from public.occasions where id = c.occasion_id for share;
 if not private.card_is_usable(c.id) then raise exception 'Card is not available' using errcode = '22023'; end if;
 return c;
end $$;

-- Defense in depth: validate even privileged direct writes and bind server versions.
create function private.validate_draft_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.card_templates;
begin
 if TG_OP = 'UPDATE' and new.personalization_data is not distinct from old.personalization_data then return new; end if;
 perform private.lock_usable_card(new.card_id);
 new.personalization_data := private.validate_personalization(new.card_id,new.personalization_data);
 select * into t from public.card_templates where card_id = new.card_id;
 if not found then raise exception 'Card has no template' using errcode = '22023'; end if;
 new.template_id := t.id; new.template_version := t.version;
 return new;
end $$;
create trigger validate_draft_write before insert or update on public.card_drafts
for each row execute function private.validate_draft_write();

create function private.snapshot_generation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.cards; t public.card_templates;
begin
 if TG_OP = 'UPDATE' then
  if new.card_snapshot is distinct from old.card_snapshot or new.template_snapshot is distinct from old.template_snapshot
   or new.template_id is distinct from old.template_id or new.template_version is distinct from old.template_version
   or new.personalization_data is distinct from old.personalization_data then
   raise exception 'Generation snapshots are immutable' using errcode = '23514';
  end if;
  return new;
 end if;
 c := private.lock_usable_card(new.card_id);
 new.personalization_data := private.validate_personalization(new.card_id,new.personalization_data);
 select * into t from public.card_templates where card_id = c.id;
 if not found then raise exception 'Card has no template' using errcode = '22023'; end if;
 new.card_snapshot := jsonb_build_object('id',c.id,'title',c.title,'slug',c.slug,'pricing_type',c.pricing_type,'price',coalesce(c.price,0),'currency',c.currency);
 new.template_id := t.id; new.template_version := t.version;
 new.template_snapshot := jsonb_build_object('id',t.id,'template_key',t.template_key,'version',t.version,'layout_config',t.layout_config,'style_config',t.style_config);
 return new;
end $$;
create trigger snapshot_generation before insert or update on public.generated_cards
for each row execute function private.snapshot_generation();

-- Public projections expose only explicitly listed values, including safe field config.
create function private.public_card(p_card_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
 'id',c.id,'title',c.title,'slug',c.slug,'description',c.description,'style',c.style,
 'is_available',c.is_available,'pricing_type',c.pricing_type,'price',c.price,'currency',c.currency,
 'available_for_purchase',false,
 'occasion',(select jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug) from public.occasions o where o.id=c.occasion_id and o.is_active),
 'category',(select jsonb_build_object('id',g.id,'name',g.name,'slug',g.slug) from public.categories g where g.id=c.category_id and g.is_active),
 'preview_assets',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'storage_path',i.storage_path,'alt_text',i.alt_text,'image_type',i.image_type) order by i.sort_order,i.id)
  from public.card_images i where i.card_id=c.id and i.image_type in ('thumbnail','preview')),'[]'::jsonb))
 from public.cards c where c.id=p_card_id and private.card_is_public(c.id);
$$;
create function public.get_card_catalogue(p_occasion uuid default null,p_category uuid default null,p_style text default null,p_available boolean default null,p_limit integer default 24,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 then raise exception 'Invalid pagination' using errcode = '22023'; end if;
 select coalesce(jsonb_agg(private.public_card(c.id) order by c.sort_order,c.id),'[]'::jsonb) into result
 from (select * from public.cards where private.card_is_public(id)
  and (p_occasion is null or occasion_id=p_occasion) and (p_category is null or category_id=p_category)
  and (p_style is null or style=p_style) and (p_available is null or is_available=p_available)
  order by sort_order,id limit p_limit offset p_offset) c;
 return result;
end $$;
create function public.get_card_detail(p_card_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
 result := private.public_card(p_card_id);
 if result is null then return null; end if;
 return result || jsonb_build_object('personalization_fields',coalesce((
  select jsonb_agg(jsonb_build_object('field_key',field_key,'label',label,'field_type',field_type,'placeholder',placeholder,'help_text',help_text,'is_required',is_required,
    'config',jsonb_strip_nulls(jsonb_build_object('min_length',config->'min_length','max_length',config->'max_length','min',config->'min','max',config->'max','options',config->'options'))) order by sort_order,id)
  from public.personalization_fields where card_id=p_card_id),'[]'::jsonb));
end $$;
create function public.quote_card(p_card_id uuid,p_expected_price numeric default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.cards;
begin
 select * into c from public.cards where id=p_card_id and private.card_is_public(id);
 if not found then return null; end if;
 return jsonb_build_object('card_id',c.id,'price',coalesce(c.price,0),'currency','EUR','pricing_type',c.pricing_type,
 'available_for_purchase',false,'can_generate',c.pricing_type='free' and c.is_available,
 'requote_required',p_expected_price is not null and p_expected_price is distinct from coalesce(c.price,0));
end $$;

create function public.create_card_draft(p_card_id uuid,p_personalization_data jsonb) returns public.card_drafts
language plpgsql security definer set search_path = '' as $$
declare result public.card_drafts; uid uuid := private.require_user();
begin
 perform private.lock_usable_card(p_card_id);
 insert into public.card_drafts(user_id,card_id,personalization_data) values(uid,p_card_id,p_personalization_data) returning * into result;
 return result;
end $$;
create function public.update_card_draft(p_draft_id uuid,p_personalization_data jsonb) returns public.card_drafts
language plpgsql security definer set search_path = '' as $$
declare d public.card_drafts; uid uuid := private.require_user();
begin
 select * into d from public.card_drafts where id=p_draft_id and user_id=uid and archived_at is null for update;
 if not found then raise exception 'Draft not found' using errcode = 'P0002'; end if;
 perform private.lock_usable_card(d.card_id);
 perform private.validate_personalization(d.card_id,p_personalization_data);
 update public.card_drafts set personalization_data=p_personalization_data where id=d.id returning * into d;
 return d;
end $$;
create function public.generate_card(p_draft_id uuid,p_expected_price numeric default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.card_drafts; c public.cards; g public.generated_cards; uid uuid := private.require_user();
begin
 select * into d from public.card_drafts where id=p_draft_id and user_id=uid and archived_at is null for update;
 if not found then raise exception 'Draft not found' using errcode = 'P0002'; end if;
 select * into c from public.cards where id=d.card_id for update;
 if not found or not private.card_is_public(c.id) then raise exception 'Card is not available' using errcode = '22023'; end if;
 if p_expected_price is not null and p_expected_price is distinct from coalesce(c.price,0) then
  return jsonb_build_object('status','requote_required','quote',public.quote_card(c.id,p_expected_price));
 end if;
 perform private.lock_usable_card(c.id);
 perform private.validate_personalization(c.id,d.personalization_data);
 insert into public.generated_cards(user_id,card_id,source_draft_id,personalization_data,status)
 values(uid,c.id,d.id,d.personalization_data,'processing') returning * into g;
 return jsonb_build_object('status','processing','generated_card',to_jsonb(g));
end $$;
create function public.delete_card_draft(p_draft_id uuid,p_archive boolean default true) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user();
begin
 if p_archive is null then raise exception 'Archive flag is required' using errcode = '22023'; end if;
 if p_archive then update public.card_drafts set archived_at=now() where id=p_draft_id and user_id=uid;
 else delete from public.card_drafts where id=p_draft_id and user_id=uid;
 end if;
 if not found then raise exception 'Draft not found' using errcode = 'P0002'; end if;
 return true;
end $$;
create function public.get_generated_cards(p_id uuid default null,p_limit integer default 24,p_offset integer default 0) returns setof public.generated_cards
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.require_user();
begin
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 then raise exception 'Invalid pagination' using errcode = '22023'; end if;
 return query select * from public.generated_cards where user_id=uid and (p_id is null or id=p_id) order by created_at desc,id limit p_limit offset p_offset;
end $$;
create function public.set_card_favorite(p_card_id uuid,p_favorite boolean default true) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user();
begin
 if p_favorite is null then raise exception 'Favorite flag required' using errcode = '22023'; end if;
 if p_favorite then
  if not private.card_is_public(p_card_id) then raise exception 'Card is not public' using errcode = '22023'; end if;
  insert into public.favorites(user_id,card_id) values(uid,p_card_id) on conflict do nothing;
 else delete from public.favorites where user_id=uid and card_id=p_card_id;
 end if;
 return p_favorite;
end $$;

-- Worker API: never granted to browser roles; files must already exist in owner storage.
create function public.finish_card_generation(p_generation_id uuid,p_output_image_path text default null,p_error text default null) returns public.generated_cards
language plpgsql security definer set search_path = '' as $$
declare g public.generated_cards;
begin
 select * into g from public.generated_cards where id=p_generation_id for update;
 if not found or g.status <> 'processing' then raise exception 'Generation is not processing' using errcode = '22023'; end if;
 if p_error is not null then
  update public.generated_cards set status='failed',error_message=left(p_error,1000) where id=g.id returning * into g;
 else
  if p_output_image_path is null or split_part(p_output_image_path,'/',1) <> g.user_id::text or not exists(
   select 1 from storage.objects where bucket_id='user-generated-cards' and name=p_output_image_path
  ) then raise exception 'Owned output image required' using errcode = '22023'; end if;
  update public.generated_cards set status='completed',output_image_path=p_output_image_path,error_message=null where id=g.id returning * into g;
 end if;
 return g;
end $$;

-- Generic admin patch API: explicit entity and column allowlists, no ownership tables.
create function public.admin_save_card_data(p_entity text,p_data jsonb,p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare allowed text[]; k text; cols text := ''; vals text := ''; assignments text := ''; result jsonb;
begin
 perform private.require_user();
 if not private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
 allowed := case p_entity
 when 'cards' then array['title','slug','description','occasion_id','category_id','status','pricing_type','price','currency','is_available','is_featured','sort_order','style']
 when 'categories' then array['name','slug','description','is_active','sort_order']
 when 'occasions' then array['name','slug','description','is_active','sort_order']
 when 'card_images' then array['card_id','storage_path','alt_text','image_type','sort_order']
 when 'card_templates' then array['card_id','template_key','layout_config','style_config']
 when 'personalization_fields' then array['card_id','field_key','label','field_type','placeholder','help_text','is_required','sort_order','config']
 else null end;
 if allowed is null or p_data is null or jsonb_typeof(p_data) <> 'object' or p_data = '{}'::jsonb then raise exception 'Invalid admin patch' using errcode = '22023'; end if;
 for k in select jsonb_object_keys(p_data) loop
  if not k = any(allowed) then raise exception 'Unsupported admin field: %',k using errcode = '22023'; end if;
  cols := cols || format('%I,',k); vals := vals || format('r.%I,',k); assignments := assignments || format('%I=r.%I,',k,k);
 end loop;
 if p_id is null then
  execute format('insert into public.%I as t (%s) select %s from jsonb_populate_record(null::public.%I,$1) r returning to_jsonb(t)',p_entity,rtrim(cols,','),rtrim(vals,','),p_entity) into result using p_data;
 else
  execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) r where t.id=$2 returning to_jsonb(t)',p_entity,rtrim(assignments,','),p_entity) into result using p_data,p_id;
  if result is null then raise exception 'Catalog record not found' using errcode = 'P0002'; end if;
 end if;
 return result;
end $$;

-- Remove bypass paths: writes use RPC validation; internal config is admin-only.
revoke insert(user_id,card_id,personalization_data), update(personalization_data), delete on public.card_drafts from authenticated;
revoke insert(user_id,card_id), delete on public.favorites from authenticated;
drop policy catalog_read on public.card_templates;
create policy admin_template_read on public.card_templates for select to authenticated using ((select private.is_admin()));
drop policy catalog_read on public.personalization_fields;
create policy admin_field_read on public.personalization_fields for select to authenticated using ((select private.is_admin()));
revoke select on public.card_templates, public.personalization_fields from anon;
-- Other public catalog tables also use RPC projections, not SELECT *.
create function private.asset_is_public(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.card_images where storage_path=p_name and private.card_is_public(card_id));
$$;
drop policy card_asset_read on storage.objects;
drop policy card_asset_admin on storage.objects;
create policy card_asset_read on storage.objects for select to anon, authenticated using (
 bucket_id='card-assets' and (private.asset_is_public(name) or (select private.is_admin()))
);
create policy card_asset_insert on storage.objects for insert to authenticated with check (bucket_id='card-assets' and (select private.is_admin()));
create policy card_asset_update on storage.objects for update to authenticated using (bucket_id='card-assets' and (select private.is_admin())) with check (bucket_id='card-assets' and (select private.is_admin()));
create policy card_asset_delete on storage.objects for delete to authenticated using (bucket_id='card-assets' and (select private.is_admin()));
update storage.buckets set allowed_mime_types=array['image/png','image/jpeg'],file_size_limit=10485760 where id='user-generated-cards';

-- All current rows were absent at preflight. Missing historical data is never fabricated.
alter table public.card_drafts alter column template_id set not null, alter column template_version set not null;
alter table public.generated_cards alter column card_snapshot set not null, alter column template_snapshot set not null,
 alter column template_id set not null, alter column template_version set not null;

do $$
declare t text; f record;
begin
 foreach t in array array['cards','categories','occasions','card_images'] loop
  execute format('drop policy catalog_read on public.%I',t);
  execute format('create policy admin_catalog_read on public.%I for select to authenticated using ((select private.is_admin()))',t);
  execute format('revoke select on public.%I from anon',t);
 end loop;
 -- Explicitly restrict all newly introduced functions, leaving old policies' helpers intact.
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='private' and p.proname in (
 'lock_card_configuration','version_template','capture_template_version','reject_version_mutation','validate_field_config',
 'validate_personalization','require_user','lock_usable_card','validate_draft_write','snapshot_generation','public_card','asset_is_public'))
 or (n.nspname='public' and p.proname in (
 'get_card_catalogue','get_card_detail','quote_card','create_card_draft','update_card_draft','generate_card','delete_card_draft',
 'get_generated_cards','set_card_favorite','finish_card_generation','admin_save_card_data')) loop
  execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 end loop;
end $$;
grant execute on function private.asset_is_public(text) to anon, authenticated;
grant execute on function public.get_card_catalogue(uuid,uuid,text,boolean,integer,integer),public.get_card_detail(uuid),public.quote_card(uuid,numeric) to anon, authenticated;
grant execute on function public.create_card_draft(uuid,jsonb),public.update_card_draft(uuid,jsonb),public.generate_card(uuid,numeric),public.delete_card_draft(uuid,boolean),public.get_generated_cards(uuid,integer,integer),public.set_card_favorite(uuid,boolean),public.admin_save_card_data(text,jsonb,uuid) to authenticated;
grant execute on function public.finish_card_generation(uuid,text,text) to service_role;
notify pgrst, 'reload schema';
