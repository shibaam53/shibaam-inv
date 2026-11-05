-- =============================================================================
-- Shibaam | Migration 1: foundation
-- Enums, profiles/roles, categories, UOMs, products, perforated-sheet specs
-- (pitch + derived open area), conversion rules, settings, audit trail.
--
-- Conventions (see AGENTS.md):
--   * every table in `public` has RLS enabled (migration 3)
--   * helper/internal functions live in schema `private` (not exposed by the API)
--   * SECURITY DEFINER functions always `set search_path = ''`
--   * numeric everywhere for quantities, never float; NO rounding in calculations
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------- enums -----
create type public.user_role      as enum ('super_user', 'normal_user');
create type public.product_status as enum ('active', 'archived');
create type public.tracking_mode  as enum ('aggregate', 'roll');
create type public.movement_type  as enum ('opening', 'add', 'remove', 'correction', 'reversal');
create type public.bill_status    as enum ('with_bill', 'without_bill');
create type public.hole_pattern   as enum ('staggered_60', 'straight_90', 'other');
create type public.hole_shape     as enum ('round', 'other');
create type public.uom_dimension  as enum ('length', 'weight', 'area', 'count', 'other');
create type public.roll_status    as enum ('in_stock', 'consumed', 'voided');

-- ------------------------------------------------------------ utilities -----
create function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -------------------------------------------------------------- profiles ----
-- One row per auth user. Role lives HERE, never in JWT/user_metadata
-- (user_metadata is user-editable). Clients get no write access to this table;
-- changes go through admin_update_profile() or the admin-create-user Edge Function.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  role        public.user_role not null default 'normal_user',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- New auth users always start as an ACTIVE NORMAL USER. Promote the first
-- Super User once with docs/bootstrap-super-user.sql.
create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- --------------------------------------------------- authorization helpers --
create function private.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  );
$$;

create function private.is_super_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.role = 'super_user'
  );
$$;

create function private.require_active_user()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active_user() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
end $$;

create function private.require_super_user()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_super_user() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
end $$;

-- ------------------------------------------------- categories / UOMs --------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  created_at  timestamptz not null default now()
);

create table public.uoms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (length(trim(code)) > 0),
  name        text not null check (length(trim(name)) > 0),
  dimension   public.uom_dimension not null,
  created_at  timestamptz not null default now()
);

-- Starter catalogue only. The final UOM list is an open item (PROJECT.md §14).
insert into public.uoms (code, name, dimension) values
  ('m',      'Meter',         'length'),
  ('ft',     'Feet',          'length'),
  ('in',     'Inch',          'length'),
  ('mm',     'Millimeter',    'length'),
  ('kg',     'Kilogram',      'weight'),
  ('sqm',    'Square meter',  'area'),
  ('sqft',   'Square feet',   'area'),
  ('pcs',    'Piece',         'count'),
  ('roll',   'Roll',          'count'),
  ('sheet', 'Sheet',        'count')
on conflict (code) do nothing;

-- --------------------------------------------------------------- products ---
create table public.products (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique check (length(trim(code)) > 0),
  name                 text not null check (length(trim(name)) > 0),
  category_id          uuid references public.categories (id) on delete restrict,
  description          text,
  status               public.product_status not null default 'active',
  tracking_mode        public.tracking_mode not null default 'aggregate',
  -- Stock is always stored in this unit. Changing it is blocked once the product has movements.
  base_uom_id          uuid not null references public.uoms (id) on delete restrict,
  -- Threshold is expressed in the base UOM. 0 = no low-stock alert.
  low_stock_threshold  numeric not null default 0 check (low_stock_threshold >= 0),
  -- Free-form extra attributes (mesh count, SWG, wire diameter, material ...).
  specs                jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create index products_base_uom_idx on public.products (base_uom_id);
create trigger products_updated_at before update on public.products
  for each row execute function private.set_updated_at();

-- Permitted units for a product (the base UOM is always permitted implicitly).
-- requires_measurement = the actual base-unit quantity must be captured per entry
-- (e.g. a roll whose real length/weight varies). No conversion is ever assumed.
create table public.product_uoms (
  product_id           uuid not null references public.products (id) on delete cascade,
  uom_id               uuid not null references public.uoms (id) on delete restrict,
  requires_measurement boolean not null default false,
  primary key (product_id, uom_id)
);
create index product_uoms_uom_idx on public.product_uoms (uom_id);

-- ------------------------------------------- perforated sheets: pitch -------
-- Pitch = centre-to-centre distance between adjacent holes. Pitch + hole diameter
-- determine OPEN AREA, which is derived (never typed in). Identity fields are
-- locked once the product has stock movements (migration 2).
create table public.product_perforation (
  product_id       uuid primary key references public.products (id) on delete cascade,
  hole_shape       public.hole_shape not null default 'round',
  hole_pattern     public.hole_pattern not null,
  hole_diameter_mm numeric not null check (hole_diameter_mm > 0),
  pitch_mm         numeric not null check (pitch_mm > 0),
  thickness_mm     numeric check (thickness_mm > 0),
  constraint pitch_greater_than_diameter
    check (hole_shape <> 'round' or pitch_mm > hole_diameter_mm)
);

-- Formulas are INACTIVE until the client confirms them (PROJECT.md §6).
create table public.open_area_formulas (
  hole_shape   public.hole_shape   not null,
  hole_pattern public.hole_pattern not null,
  is_active    boolean not null default false,
  source       text,
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  primary key (hole_shape, hole_pattern)
);
insert into public.open_area_formulas (hole_shape, hole_pattern) values
  ('round', 'staggered_60'),
  ('round', 'straight_90');

-- Round holes only. d = hole diameter, p = nearest-neighbour centre distance (same unit).
-- No ROUND()/TRUNC(): numeric keeps full precision; the UI rounds for display only.
create function public.calc_open_area_pct(
  p_shape public.hole_shape, p_pattern public.hole_pattern, p_d numeric, p_p numeric
) returns numeric language sql immutable set search_path = '' as $$
  select case
    when p_shape = 'round' and p_pattern = 'staggered_60' then
      (3.14159265358979323846264338327950288419716939937510::numeric / (2 * sqrt(3::numeric)))
        * power(p_d / p_p, 2) * 100
    when p_shape = 'round' and p_pattern = 'straight_90' then
      (3.14159265358979323846264338327950288419716939937510::numeric / 4)
        * power(p_d / p_p, 2) * 100
    else null
  end;
$$;

create view public.perforated_sheet_specs with (security_invoker = true) as
select
  pp.product_id, pp.hole_shape, pp.hole_pattern,
  pp.hole_diameter_mm, pp.pitch_mm, pp.thickness_mm,
  case when f.is_active
       then public.calc_open_area_pct(pp.hole_shape, pp.hole_pattern, pp.hole_diameter_mm, pp.pitch_mm)
  end as open_area_pct
from public.product_perforation pp
left join public.open_area_formulas f
  on f.hole_shape = pp.hole_shape and f.hole_pattern = pp.hole_pattern;

-- -------------------------------------------------- conversion rules --------
-- Versioned, INACTIVE by default. A rule converts entered UOM -> product base UOM.
-- product_id NULL = global rule. Product-specific rules win over global ones.
create table public.conversion_rules (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid references public.products (id) on delete restrict,
  from_uom_id  uuid not null references public.uoms (id) on delete restrict,
  to_uom_id    uuid not null references public.uoms (id) on delete restrict,
  factor       numeric not null check (factor > 0),
  version      integer not null default 1 check (version > 0),
  is_active    boolean not null default false,
  source       text,
  notes        text,
  approved_by  uuid references public.profiles (id),
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint conversion_distinct_uoms check (from_uom_id <> to_uom_id)
);
create unique index conversion_rules_version_uq on public.conversion_rules (
  coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid), from_uom_id, to_uom_id, version);
create unique index conversion_rules_one_active on public.conversion_rules (
  coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid), from_uom_id, to_uom_id)
  where is_active;

-- A rule's definition never changes. To change a factor: add a new version, activate it,
-- deactivate the old one. Movements keep pointing at the version they used.
create function private.conversion_rules_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.product_id is distinct from old.product_id
     or new.from_uom_id <> old.from_uom_id
     or new.to_uom_id   <> old.to_uom_id
     or new.factor      <> old.factor
     or new.version     <> old.version then
    raise exception 'conversion_rule_immutable: create a new version instead' using errcode = '42501';
  end if;
  if new.is_active and not old.is_active then
    new.approved_by := (select auth.uid());
    new.approved_at := now();
  end if;
  return new;
end $$;
create trigger conversion_rules_guard before update on public.conversion_rules
  for each row execute function private.conversion_rules_guard();

-- ------------------------------------------------------ system settings -----
create table public.system_settings (
  key         text primary key check (length(trim(key)) > 0),
  value       jsonb not null,
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now()
);
create trigger system_settings_updated_at before update on public.system_settings
  for each row execute function private.set_updated_at();

-- ------------------------------------------------------------ audit trail ---
create table public.audit_events (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   text,
  old_data    jsonb,
  new_data    jsonb
);
create index audit_events_entity_idx on public.audit_events (entity, entity_id);
create index audit_events_time_idx on public.audit_events (occurred_at desc);

create function private.block_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end $$;
create trigger audit_events_append_only before update or delete on public.audit_events
  for each row execute function private.block_mutation();
create trigger audit_events_no_truncate before truncate on public.audit_events
  for each statement execute function private.block_mutation();

-- Generic row audit. tg_argv[0] = name of the column used as entity_id.
create function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  insert into public.audit_events (actor_id, action, entity, entity_id, old_data, new_data)
  values ((select auth.uid()), lower(tg_op), tg_table_name,
          coalesce(v_new, v_old) ->> tg_argv[0], v_old, v_new);
  return null;
end $$;

create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function private.audit_row('id');
create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function private.audit_row('id');
create trigger audit_uoms after insert or update or delete on public.uoms
  for each row execute function private.audit_row('id');
create trigger audit_products after insert or update or delete on public.products
  for each row execute function private.audit_row('id');
create trigger audit_product_uoms after insert or update or delete on public.product_uoms
  for each row execute function private.audit_row('product_id');
create trigger audit_product_perforation after insert or update or delete on public.product_perforation
  for each row execute function private.audit_row('product_id');
create trigger audit_open_area_formulas after insert or update or delete on public.open_area_formulas
  for each row execute function private.audit_row('hole_pattern');
create trigger audit_conversion_rules after insert or update or delete on public.conversion_rules
  for each row execute function private.audit_row('id');
create trigger audit_system_settings after insert or update or delete on public.system_settings
  for each row execute function private.audit_row('key');
