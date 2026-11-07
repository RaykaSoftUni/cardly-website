-- Cardly catalog and ownership foundation. No application sample data.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text,
 avatar_url text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.user_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'user' check (role in ('user','admin')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.occasions (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 slug text not null unique,
 description text,
 is_active boolean not null default true,
 sort_order integer not null default 0 check (sort_order >= 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.categories (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 slug text not null unique,
 description text,
 is_active boolean not null default true,
 sort_order integer not null default 0 check (sort_order >= 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.cards (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 slug text not null unique,
 description text,
 occasion_id uuid references public.occasions(id),
 category_id uuid references public.categories(id),
 status text not null default 'draft' check (status in ('draft','published','archived')),
 pricing_type text not null default 'free' check (pricing_type in ('free','paid')),
 price numeric(12,2) check (price >= 0 and price <> 'NaN'::numeric),
 currency text not null default 'EUR' check (currency = 'EUR'),
 is_available boolean not null default true,
 is_featured boolean not null default false,
 sort_order integer not null default 0 check (sort_order >= 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint free_price check (pricing_type <> 'free' or price is null or price = 0),
 constraint paid_unavailable check (pricing_type <> 'paid' or not is_available)
);
create table public.card_images (
 id uuid primary key default gen_random_uuid(),
 card_id uuid not null references public.cards(id) on delete cascade,
 storage_path text not null check (storage_path <> '' and storage_path !~ '^[a-zA-Z]+://'),
 alt_text text,
 image_type text not null check (image_type in ('thumbnail','preview','background','decorative')),
 sort_order integer not null default 0 check (sort_order >= 0),
 created_at timestamptz not null default now()
);
create table public.card_templates (
 id uuid primary key default gen_random_uuid(),
 card_id uuid not null unique references public.cards(id) on delete cascade,
 template_key text not null unique,
 version integer not null default 1 check (version > 0),
 layout_config jsonb not null check (jsonb_typeof(layout_config) = 'object'),
 style_config jsonb check (jsonb_typeof(style_config) = 'object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.personalization_fields (
 id uuid primary key default gen_random_uuid(),
 card_id uuid not null references public.cards(id) on delete cascade,
 field_key text not null,
 label text not null,
 field_type text not null check (field_type in ('text','textarea','number','select','image')),
 placeholder text,
 help_text text,
 is_required boolean not null default false,
 sort_order integer not null default 0 check (sort_order >= 0),
 config jsonb check (jsonb_typeof(config) = 'object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (card_id, field_key)
);
create table public.card_drafts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 card_id uuid not null references public.cards(id),
 personalization_data jsonb not null default '{}'::jsonb check (jsonb_typeof(personalization_data) = 'object'),
 generated_text jsonb,
 generated_image_path text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.generated_cards (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 card_id uuid not null references public.cards(id),
 source_draft_id uuid references public.card_drafts(id) on delete set null,
 personalization_data jsonb not null check (jsonb_typeof(personalization_data) = 'object'),
 generated_text jsonb,
 output_image_path text,
 output_pdf_path text,
 status text not null default 'processing' check (status in ('processing','completed','failed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.favorites (
 user_id uuid not null references auth.users(id) on delete cascade,
 card_id uuid not null references public.cards(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (user_id, card_id)
);
create index cards_occasion_id_idx on public.cards (occasion_id);
create index cards_category_id_idx on public.cards (category_id);
create index card_images_card_id_idx on public.card_images (card_id);
create index card_images_storage_path_idx on public.card_images (storage_path);
create index personalization_fields_card_id_idx on public.personalization_fields (card_id);
create index card_drafts_user_id_idx on public.card_drafts (user_id);
create index card_drafts_card_id_idx on public.card_drafts (card_id);
create index generated_cards_user_id_idx on public.generated_cards (user_id);
create index generated_cards_card_id_idx on public.generated_cards (card_id);
create index generated_cards_source_draft_id_idx on public.generated_cards (source_draft_id);
create index favorites_card_id_idx on public.favorites (card_id);

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin');
$$;
create function private.card_is_public(card uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.cards c
  where c.id = card and c.status = 'published'
  and (c.occasion_id is null or exists (select 1 from public.occasions o where o.id = c.occasion_id and o.is_active))
  and (c.category_id is null or exists (select 1 from public.categories g where g.id = c.category_id and g.is_active))
 );
$$;
create function private.card_is_usable(card uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.card_is_public(card) and exists (
  select 1 from public.cards where id = card and is_available and pricing_type = 'free'
 );
$$;
create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
 new.updated_at := now();
 return new;
end;
$$;
create function private.provision_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles (id) values (new.id);
 insert into public.user_roles (user_id, role) values (new.id, 'user');
 return new;
end;
$$;
create trigger cardly_provision_user after insert on auth.users
for each row execute function private.provision_user();
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;
insert into public.user_roles (user_id) select id from auth.users on conflict (user_id) do nothing;

-- Defense in depth for identity fields, including future broader grants.
create function private.guard_owned_record() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.user_id is distinct from old.user_id or new.id is distinct from old.id
    or new.card_id is distinct from old.card_id then
  raise exception 'Record identity, owner and template cannot be changed' using errcode = '23514';
 end if;
 return new;
end;
$$;
create function private.check_generated_source() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP = 'INSERT' and not private.card_is_usable(new.card_id) then
  raise exception 'Generation requires a published, available free card' using errcode = '23514';
 end if;
 if new.source_draft_id is not null and not exists (
  select 1 from public.card_drafts where id = new.source_draft_id
  and user_id = new.user_id and card_id = new.card_id
 ) then
  raise exception 'Source draft must belong to the same user and card' using errcode = '23514';
 end if;
 return new;
end;
$$;
create trigger generated_source before insert or update of source_draft_id, user_id, card_id
on public.generated_cards for each row execute function private.check_generated_source();
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant all on public.profiles to service_role;
create trigger set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;
grant all on public.user_roles to service_role;
create trigger set_updated_at before update on public.user_roles for each row execute function private.set_updated_at();
alter table public.occasions enable row level security;
revoke all on public.occasions from anon, authenticated;
grant all on public.occasions to service_role;
create trigger set_updated_at before update on public.occasions for each row execute function private.set_updated_at();
alter table public.categories enable row level security;
revoke all on public.categories from anon, authenticated;
grant all on public.categories to service_role;
create trigger set_updated_at before update on public.categories for each row execute function private.set_updated_at();
alter table public.cards enable row level security;
revoke all on public.cards from anon, authenticated;
grant all on public.cards to service_role;
create trigger set_updated_at before update on public.cards for each row execute function private.set_updated_at();
alter table public.card_images enable row level security;
revoke all on public.card_images from anon, authenticated;
grant all on public.card_images to service_role;
alter table public.card_templates enable row level security;
revoke all on public.card_templates from anon, authenticated;
grant all on public.card_templates to service_role;
create trigger set_updated_at before update on public.card_templates for each row execute function private.set_updated_at();
alter table public.personalization_fields enable row level security;
revoke all on public.personalization_fields from anon, authenticated;
grant all on public.personalization_fields to service_role;
create trigger set_updated_at before update on public.personalization_fields for each row execute function private.set_updated_at();
alter table public.card_drafts enable row level security;
revoke all on public.card_drafts from anon, authenticated;
grant all on public.card_drafts to service_role;
create trigger set_updated_at before update on public.card_drafts for each row execute function private.set_updated_at();
alter table public.generated_cards enable row level security;
revoke all on public.generated_cards from anon, authenticated;
grant all on public.generated_cards to service_role;
create trigger set_updated_at before update on public.generated_cards for each row execute function private.set_updated_at();
alter table public.favorites enable row level security;
revoke all on public.favorites from anon, authenticated;
grant all on public.favorites to service_role;
create trigger guard_identity before update on public.card_drafts for each row execute function private.guard_owned_record();
create trigger guard_identity before update on public.generated_cards for each row execute function private.guard_owned_record();
grant select on public.profiles, public.user_roles, public.card_drafts, public.generated_cards, public.favorites to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
create policy profile_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profile_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy role_read on public.user_roles for select to authenticated using (user_id = (select auth.uid()));
grant select on public.occasions to anon, authenticated;
grant insert, update, delete on public.occasions to authenticated;
create policy public_read on public.occasions for select to anon, authenticated using (is_active);
create policy admin_manage on public.occasions for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
create policy public_read on public.categories for select to anon, authenticated using (is_active);
create policy admin_manage on public.categories for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
grant select on public.cards to anon, authenticated;
grant insert, update, delete on public.cards to authenticated;
create policy public_read on public.cards for select to anon, authenticated using (private.card_is_public(id));
create policy admin_manage on public.cards for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
grant select on public.card_images to anon, authenticated;
grant insert, update, delete on public.card_images to authenticated;
create policy public_read on public.card_images for select to anon, authenticated using (private.card_is_public(card_id));
create policy admin_manage on public.card_images for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
grant select on public.card_templates to anon, authenticated;
grant insert, update, delete on public.card_templates to authenticated;
create policy public_read on public.card_templates for select to anon, authenticated using (private.card_is_public(card_id));
create policy admin_manage on public.card_templates for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
grant select on public.personalization_fields to anon, authenticated;
grant insert, update, delete on public.personalization_fields to authenticated;
create policy public_read on public.personalization_fields for select to anon, authenticated using (private.card_is_public(card_id));
create policy admin_manage on public.personalization_fields for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
grant insert (user_id, card_id, personalization_data), update (personalization_data), delete on public.card_drafts to authenticated;
create policy draft_read on public.card_drafts for select to authenticated using (user_id = (select auth.uid()));
create policy draft_insert on public.card_drafts for insert to authenticated with check (user_id = (select auth.uid()) and private.card_is_usable(card_id));
create policy draft_update on public.card_drafts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and private.card_is_usable(card_id));
create policy draft_delete on public.card_drafts for delete to authenticated using (user_id = (select auth.uid()));
create policy generated_read on public.generated_cards for select to authenticated using (user_id = (select auth.uid()));
grant insert (user_id, card_id), delete on public.favorites to authenticated;
create policy favorite_read on public.favorites for select to authenticated using (user_id = (select auth.uid()));
create policy favorite_insert on public.favorites for insert to authenticated with check (user_id = (select auth.uid()) and private.card_is_public(card_id));
create policy favorite_delete on public.favorites for delete to authenticated using (user_id = (select auth.uid()));

-- Both buckets stay private: public bucket downloads bypass object SELECT RLS.
insert into storage.buckets (id, name, public) values
 ('card-assets', 'card-assets', false),
 ('user-generated-cards', 'user-generated-cards', false);
create policy card_asset_read on storage.objects for select to anon, authenticated using (
 bucket_id = 'card-assets' and exists (
  select 1 from public.card_images i where i.storage_path = name and private.card_is_public(i.card_id)
 )
);
create policy card_asset_admin on storage.objects for all to authenticated
using (bucket_id = 'card-assets' and (select private.is_admin()))
with check (bucket_id = 'card-assets' and (select private.is_admin()));
-- User objects use <auth.uid()>/<filename>. Ownership cannot be moved by update.
create policy user_object_read on storage.objects for select to authenticated
using (bucket_id = 'user-generated-cards' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy user_object_insert on storage.objects for insert to authenticated
with check (bucket_id = 'user-generated-cards' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy user_object_update on storage.objects for update to authenticated
using (bucket_id = 'user-generated-cards' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'user-generated-cards' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy user_object_delete on storage.objects for delete to authenticated
using (bucket_id = 'user-generated-cards' and (storage.foldername(name))[1] = (select auth.uid())::text);

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin(), private.card_is_public(uuid), private.card_is_usable(uuid) to anon, authenticated;
