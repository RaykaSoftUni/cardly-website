-- Catalog entries may be advertised while unavailable. Usable published entries
-- must have a server-managed template before personalization is offered.
create function private.require_publishable_template() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' and new.is_available and not exists(select 1 from public.card_templates where card_id=new.id) then
  raise exception 'Save the card as a draft and configure a template before publishing it as available' using errcode='23514';
 end if;
 return new;
end $$;
create trigger require_publishable_template before insert or update on public.cards for each row execute function private.require_publishable_template();
revoke all on function private.require_publishable_template() from public,anon,authenticated;
