-- Explicitly qualify requested field identities and authorize before locking.
create or replace function public.admin_reorder_fields(p_card_id uuid,p_field_ids uuid[]) returns boolean
language plpgsql security definer set search_path='' as $$
declare count_fields integer;
begin
 perform private.require_admin();
 perform 1 from public.cards where id=p_card_id for update;
 if not found then raise exception 'Card not found' using errcode='P0002'; end if;
 select count(*) into count_fields from public.personalization_fields where card_id=p_card_id;
 if p_field_ids is null or cardinality(p_field_ids)<>count_fields
 or (select count(distinct requested.field_id) from unnest(p_field_ids) requested(field_id))<>count_fields
 or exists(select 1 from unnest(p_field_ids) requested(field_id) where not exists(select 1 from public.personalization_fields f where f.id=requested.field_id and f.card_id=p_card_id)) then
 raise exception 'Supply each card field exactly once' using errcode='22023'; end if;
 update public.personalization_fields f set sort_order=t.ordinality-1 from unnest(p_field_ids) with ordinality t(id,ordinality) where f.id=t.id and f.card_id=p_card_id;
 return true;
end $$;
create or replace function public.admin_set_user_role(p_user_id uuid,p_role text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 -- Serialize role edits and recheck authorization after obtaining the lock.
 perform private.require_admin();
 lock table public.user_roles in share row exclusive mode;
 uid:=private.require_admin();
 if p_user_id=uid then raise exception 'You cannot change your own role' using errcode='42501'; end if;
 if p_role is null or p_role not in ('user','admin') then raise exception 'Invalid role' using errcode='22023'; end if;
 update public.user_roles set role=p_role where user_id=p_user_id;
 if not found then raise exception 'User not found' using errcode='P0002'; end if;
 return jsonb_build_object('user_id',p_user_id,'role',p_role);
end $$;
