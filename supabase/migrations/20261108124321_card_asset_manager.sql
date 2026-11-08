alter table public.card_images add column is_primary boolean not null default false;
alter table public.card_images drop constraint card_images_image_type_check;
alter table public.card_images add constraint card_images_image_type_check check(image_type in ('thumbnail','preview','background','hero','decorative'));
alter table public.card_images drop constraint public_image_alt_required;
alter table public.card_images add constraint public_image_alt_required check ((not is_primary and image_type not in ('thumbnail','preview')) or btrim(coalesce(alt_text,''))<>'');
create unique index card_images_one_primary_idx on public.card_images(card_id) where is_primary;
-- Select an existing preview deterministically; never invent asset records or IDs.
update public.card_images i set is_primary=true where id in (
 select distinct on(card_id) id from public.card_images where image_type in ('preview','thumbnail') order by card_id,(image_type='preview') desc,sort_order,id
);
create function public.admin_save_card_asset(p_card_id uuid,p_asset jsonb,p_id uuid default null) returns public.card_images
language plpgsql security definer set search_path='' as $$
declare result public.card_images; previous public.card_images; primary_image boolean; k text;
begin
 perform private.require_admin();
 perform 1 from public.cards where id=p_card_id for update;
 if not found then raise exception 'Card not found' using errcode='P0002'; end if;
 if p_asset is null or jsonb_typeof(p_asset)<>'object' then raise exception 'Asset metadata required' using errcode='22023'; end if;
 for k in select jsonb_object_keys(p_asset) loop
  if k not in ('storage_path','alt_text','image_type','sort_order','is_primary') then raise exception 'Unsupported asset field' using errcode='22023'; end if;
 end loop;
 if p_id is not null then
  select * into previous from public.card_images where id=p_id and card_id=p_card_id;
  if not found then raise exception 'Asset not found for this card' using errcode='P0002'; end if;
 end if;
 primary_image:=coalesce((p_asset->>'is_primary')::boolean,previous.is_primary,false);
 if btrim(coalesce(p_asset->>'alt_text',previous.alt_text,''))='' then raise exception 'Meaningful alt text is required' using errcode='22023'; end if;
 if primary_image then update public.card_images set is_primary=false where card_id=p_card_id and is_primary and id is distinct from p_id; end if;
 if p_id is null then
  insert into public.card_images(card_id,storage_path,alt_text,image_type,sort_order,is_primary)
  values(p_card_id,p_asset->>'storage_path',p_asset->>'alt_text',coalesce(p_asset->>'image_type','preview'),coalesce((p_asset->>'sort_order')::integer,0),primary_image) returning * into result;
 else
  update public.card_images set storage_path=coalesce(p_asset->>'storage_path',previous.storage_path),alt_text=coalesce(p_asset->>'alt_text',previous.alt_text),image_type=coalesce(p_asset->>'image_type',previous.image_type),sort_order=coalesce((p_asset->>'sort_order')::integer,previous.sort_order),is_primary=primary_image where id=p_id returning * into result;
 end if;
 return result;
end $$;
create function public.admin_reorder_assets(p_card_id uuid,p_asset_ids uuid[]) returns boolean
language plpgsql security definer set search_path='' as $$
declare total integer;
begin
 perform private.require_admin();
 perform 1 from public.cards where id=p_card_id for update;
 if not found then raise exception 'Card not found' using errcode='P0002'; end if;
 select count(*) into total from public.card_images where card_id=p_card_id;
 if p_asset_ids is null or cardinality(p_asset_ids)<>total or (select count(distinct requested.id) from unnest(p_asset_ids) requested(id))<>total or exists(select 1 from unnest(p_asset_ids) requested(id) where not exists(select 1 from public.card_images i where i.id=requested.id and i.card_id=p_card_id)) then raise exception 'Supply each card asset exactly once' using errcode='22023'; end if;
 update public.card_images i set sort_order=r.ordinality-1 from unnest(p_asset_ids) with ordinality r(id,ordinality) where i.id=r.id;
 return true;
end $$;
create function public.admin_asset_settings(p_max_bytes integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 if p_max_bytes is not null then
  if p_max_bytes not between 1024 and 20971520 then raise exception 'Upload limit must be between 1 KiB and 20 MiB' using errcode='22023'; end if;
  update storage.buckets set file_size_limit=p_max_bytes where id='card-assets';
 end if;
 return (select jsonb_build_object('max_bytes',file_size_limit,'mime_types',allowed_mime_types) from storage.buckets where id='card-assets');
end $$;
revoke all on function public.admin_save_card_asset(uuid,jsonb,uuid),public.admin_reorder_assets(uuid,uuid[]),public.admin_asset_settings(integer) from public,anon,authenticated;
grant execute on function public.admin_save_card_asset(uuid,jsonb,uuid),public.admin_reorder_assets(uuid,uuid[]),public.admin_asset_settings(integer) to authenticated;

create or replace function private.public_card(p_card_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('id',c.id,'title',c.title,'slug',c.slug,'description',c.description,'style',c.style,
 'design_key',(select case when t.layout_config->>'design_key' in ('birthday-type','space-explorer','wild-confetti','botanical-wishes','older-wiser','little-thanks','big-congratulations','sunshine-split','memory-window','paper-party') then t.layout_config->>'design_key' else null end from public.card_templates t where t.card_id=c.id),
 'is_available',c.is_available,'pricing_type',c.pricing_type,'price',c.price,'currency',c.currency,'available_for_purchase',false,
 'occasion',(select jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug) from public.occasions o where o.id=c.occasion_id and o.is_active),
 'category',(select jsonb_build_object('id',g.id,'name',g.name,'slug',g.slug) from public.categories g where g.id=c.category_id and g.is_active),
 'preview_assets',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'storage_path',i.storage_path,'alt_text',i.alt_text,'image_type',i.image_type,'is_primary',i.is_primary) order by i.is_primary desc,i.sort_order,i.id) from public.card_images i where i.card_id=c.id and (i.is_primary or i.image_type in ('thumbnail','preview'))),'[]'::jsonb))
 from public.cards c where c.id=p_card_id and private.card_is_public(c.id);
$$;

notify pgrst,'reload schema';
