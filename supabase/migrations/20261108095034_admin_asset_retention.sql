-- Allow the UI to explain retention before requesting deletion through Storage.
create function public.admin_asset_deletable(p_path text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_admin();
 if p_path is null or p_path='' then raise exception 'Asset path required' using errcode='22023'; end if;
 return not private.asset_is_referenced(p_path);
end $$;
revoke all on function public.admin_asset_deletable(text) from public,anon,authenticated;
grant execute on function public.admin_asset_deletable(text) to authenticated;
notify pgrst,'reload schema';
