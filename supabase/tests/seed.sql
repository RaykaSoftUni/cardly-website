-- Verify committed demo fixtures without changing them.
begin;
do $$
declare entry record; uid uuid; count_rows integer;
begin
 if (select count(*) from public.cards where slug like 'demo-%') <> 15 then raise exception 'Expected 15 seeded cards'; end if;
 if (select count(*) from public.cards where slug like 'demo-%' and status='published') <> 13 then raise exception 'Expected 13 public demos'; end if;
 if (select count(*) from public.cards c join public.card_templates t on t.card_id=c.id where c.slug in ('demo-disco-whiskers','demo-cake-catnaps') and c.status='published' and c.pricing_type='free' and c.is_available and t.layout_config->>'design_key' in ('disco-whiskers','cake-catnaps')) <> 2 then raise exception 'Animated cats incomplete'; end if;
 if jsonb_array_length(public.get_card_catalogue(p_pricing_type=>'paid')) <> 3 then raise exception 'Paid filtering failed'; end if;
 if jsonb_array_length(public.get_card_catalogue(p_search=>'Tiny space explorer')) <> 1 then raise exception 'Keyword search failed'; end if;
 if public.get_card_detail((select id from public.cards where slug='demo-draft-confetti')) is not null then raise exception 'Draft detail leaked'; end if;
 if exists(select 1 from public.cards where pricing_type='paid' and is_available) then raise exception 'Paid availability violation'; end if;
 if (select count(*) from public.user_roles r join auth.users u on u.id=r.user_id where u.raw_user_meta_data->>'demo_seed'='cardly-v1' and r.role='admin') <> 1 then raise exception 'Expected one demo admin'; end if;
 for entry in select id from auth.users where raw_user_meta_data->>'demo_seed'='cardly-v1' loop
  uid:=entry.id;
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
  set local role authenticated;
  select count(*) into count_rows from public.card_drafts;
  if count_rows <> 1 then raise exception 'Demo draft ownership failed'; end if;
  select count(*) into count_rows from public.get_generated_cards();
  if count_rows <> 1 then raise exception 'Demo generation ownership failed'; end if;
  if exists(select 1 from public.generated_cards where user_id<>auth.uid()) then raise exception 'Private data leaked'; end if;
  reset role;
 end loop;
end $$;
select 'Demo seed and ownership checks passed.' as result;
rollback;
