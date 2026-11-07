-- Public presentation identifiers are enum-like keys, never private template JSON.
create or replace function private.public_card(p_card_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('id',c.id,'title',c.title,'slug',c.slug,'description',c.description,'style',c.style,
 'design_key',(select case when t.layout_config->>'design_key' in ('birthday-type','space-explorer','wild-confetti','botanical-wishes','older-wiser','little-thanks','big-congratulations','sunshine-split','memory-window','paper-party') then t.layout_config->>'design_key' else null end from public.card_templates t where t.card_id=c.id),
 'is_available',c.is_available,'pricing_type',c.pricing_type,'price',c.price,'currency',c.currency,'available_for_purchase',false,
 'occasion',(select jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug) from public.occasions o where o.id=c.occasion_id and o.is_active),
 'category',(select jsonb_build_object('id',g.id,'name',g.name,'slug',g.slug) from public.categories g where g.id=c.category_id and g.is_active),
 'preview_assets',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'storage_path',i.storage_path,'alt_text',i.alt_text,'image_type',i.image_type) order by i.sort_order,i.id) from public.card_images i where i.card_id=c.id and i.image_type in ('thumbnail','preview')),'[]'::jsonb))
 from public.cards c where c.id=p_card_id and private.card_is_public(c.id);
$$;
drop function public.get_card_catalogue(uuid,uuid,text,boolean,integer,integer);
create function public.get_card_catalogue(p_occasion uuid default null,p_category uuid default null,p_style text default null,p_available boolean default null,p_limit integer default 24,p_offset integer default 0,p_pricing_type text default null,p_search text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset<0 or (p_pricing_type is not null and p_pricing_type not in ('free','paid')) or char_length(p_search)>200 then raise exception 'Invalid catalog filters' using errcode='22023'; end if;
 select coalesce(jsonb_agg(private.public_card(c.id) order by c.sort_order,c.id),'[]'::jsonb) into result from (
 select c.* from public.cards c left join public.occasions o on o.id=c.occasion_id left join public.categories g on g.id=c.category_id
 where private.card_is_public(c.id) and (p_occasion is null or c.occasion_id=p_occasion) and (p_category is null or c.category_id=p_category)
 and (p_style is null or c.style=p_style) and (p_available is null or c.is_available=p_available) and (p_pricing_type is null or c.pricing_type=p_pricing_type)
 and (p_search is null or strpos(lower(concat_ws(' ',c.title,c.description,c.style,o.name,g.name)),lower(btrim(p_search)))>0)
 order by c.sort_order,c.id limit p_limit offset p_offset)c;
 return result;
end $$;
revoke all on function public.get_card_catalogue(uuid,uuid,text,boolean,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.get_card_catalogue(uuid,uuid,text,boolean,integer,integer,text,text) to anon,authenticated;
notify pgrst,'reload schema';
