-- =============================================================================
-- Shibaam | Migration 3: Row Level Security, privileges, overview view
--
-- Default deny. Supabase grants broad default privileges to anon/authenticated on
-- new objects, so everything is revoked first and then granted narrowly.
-- RULE FOR FUTURE MIGRATIONS: every new table/view/function must (a) enable RLS,
-- (b) revoke default privileges, (c) grant only what the app needs.
-- =============================================================================

-- ------------------------------------------------------ overview view -------
create view public.inventory_overview with (security_invoker = true) as
select
  p.id            as product_id,
  p.code,
  p.name,
  p.category_id,
  c.name          as category_name,
  p.status,
  p.tracking_mode,
  p.base_uom_id,
  u.code          as base_uom_code,
  b.quantity      as stock_qty,
  p.low_stock_threshold,
  case
    when b.quantity <= 0 then 'out_of_stock'
    when p.low_stock_threshold > 0 and b.quantity <= p.low_stock_threshold then 'low'
    else 'healthy'
  end             as stock_status
from public.products p
join public.uoms u on u.id = p.base_uom_id
join public.stock_balances b on b.product_id = p.id
left join public.categories c on c.id = p.category_id;

-- -------------------------------------------------------------- enable RLS --
alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.uoms                enable row level security;
alter table public.products            enable row level security;
alter table public.product_uoms        enable row level security;
alter table public.product_perforation enable row level security;
alter table public.open_area_formulas  enable row level security;
alter table public.conversion_rules    enable row level security;
alter table public.system_settings     enable row level security;
alter table public.audit_events        enable row level security;
alter table public.stock_balances      enable row level security;
alter table public.stock_rolls         enable row level security;
alter table public.stock_movements     enable row level security;

-- ---------------------------------------------------------------- reads -----
-- Profiles: you can read your own row; the Super User reads everyone.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_super_user()));

-- Reference/config data: any ACTIVE user can read.
create policy categories_select          on public.categories          for select to authenticated using ((select private.is_active_user()));
create policy uoms_select                on public.uoms                for select to authenticated using ((select private.is_active_user()));
create policy products_select            on public.products            for select to authenticated using ((select private.is_active_user()));
create policy product_uoms_select        on public.product_uoms        for select to authenticated using ((select private.is_active_user()));
create policy product_perforation_select on public.product_perforation for select to authenticated using ((select private.is_active_user()));
create policy open_area_formulas_select  on public.open_area_formulas  for select to authenticated using ((select private.is_active_user()));
create policy conversion_rules_select    on public.conversion_rules    for select to authenticated using ((select private.is_active_user()));
create policy stock_balances_select      on public.stock_balances      for select to authenticated using ((select private.is_active_user()));
create policy stock_rolls_select         on public.stock_rolls         for select to authenticated using ((select private.is_active_user()));

-- Ledger: Super User sees everything; a Normal User sees only their own movements.
create policy stock_movements_select on public.stock_movements for select to authenticated
  using ((select private.is_super_user())
         or (created_by = (select auth.uid()) and (select private.is_active_user())));

-- Super User only.
create policy system_settings_select on public.system_settings for select to authenticated
  using ((select private.is_super_user()));
create policy audit_events_select on public.audit_events for select to authenticated
  using ((select private.is_super_user()));

-- --------------------------------------------- Super User configuration writes
-- (stock_balances, stock_rolls, stock_movements, profiles, audit_events get NO client writes.)
create policy categories_insert on public.categories for insert to authenticated with check ((select private.is_super_user()));
create policy categories_update on public.categories for update to authenticated using ((select private.is_super_user())) with check ((select private.is_super_user()));
create policy categories_delete on public.categories for delete to authenticated using ((select private.is_super_user()));

create policy uoms_insert on public.uoms for insert to authenticated with check ((select private.is_super_user()));
create policy uoms_update on public.uoms for update to authenticated using ((select private.is_super_user())) with check ((select private.is_super_user()));
create policy uoms_delete on public.uoms for delete to authenticated using ((select private.is_super_user()));

-- Products are archived, never deleted (no delete policy).
create policy products_insert on public.products for insert to authenticated with check ((select private.is_super_user()));
create policy products_update on public.products for update to authenticated using ((select private.is_super_user())) with check ((select private.is_super_user()));

create policy product_uoms_insert on public.product_uoms for insert to authenticated with check ((select private.is_super_user()));
create policy product_uoms_update on public.product_uoms for update to authenticated using ((select private.is_super_user())) with check ((select private.is_super_user()));
create policy product_uoms_delete on public.product_uoms for delete to authenticated using ((select private.is_super_user()));

create policy product_perforation_insert on public.product_perforation for insert to authenticated with check ((select private.is_super_user()));
create policy product_perforation_update on public.product_perforation for update to authenticated using ((select private.is_super_user())) with check ((select private.is_super_user()));
create policy product_perforation_delete on public.product_perforation for delete to authenticated using ((select private.is_super_user()));

create policy open_area_formulas_update on public.open_area_formulas for update to authenticated using ((select private.is_super_user())) with check ((select private.is_super_user()));

create policy conversion_rules_insert on public.conversion_rules for insert to authenticated with check ((select private.is_super_user()));
create policy conversion_rules_update on public.conversion_rules for update to authenticated using ((select private.is_super_user())) with check ((select private.is_super_user()));
create policy conversion_rules_delete on public.conversion_rules for delete to authenticated using ((select private.is_super_user()));

create policy system_settings_insert on public.system_settings for insert to authenticated with check ((select private.is_super_user()));
create policy system_settings_update on public.system_settings for update to authenticated using ((select private.is_super_user())) with check ((select private.is_super_user()));
create policy system_settings_delete on public.system_settings for delete to authenticated using ((select private.is_super_user()));

-- --------------------------------------------------------------- privileges --
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

-- Reads
grant select on
  public.profiles, public.categories, public.uoms, public.products, public.product_uoms,
  public.product_perforation, public.open_area_formulas, public.conversion_rules,
  public.system_settings, public.audit_events, public.stock_balances, public.stock_rolls,
  public.stock_movements, public.perforated_sheet_specs, public.inventory_overview
to authenticated;

-- Configuration writes (RLS limits these to the Super User)
grant insert, update, delete on public.categories, public.uoms, public.product_uoms,
  public.product_perforation, public.conversion_rules, public.system_settings to authenticated;
grant insert, update on public.products to authenticated;
grant update on public.open_area_formulas to authenticated;

-- RPCs (each re-checks the caller's role internally)
grant execute on function
  public.add_stock(uuid, numeric, uuid, public.bill_status, numeric, text, text),
  public.remove_stock(uuid, numeric, uuid, public.bill_status, numeric, uuid, text),
  public.set_opening_stock(uuid, numeric, uuid, numeric, text, text),
  public.correct_stock(uuid, numeric, text, uuid),
  public.reverse_stock_movement(uuid, text),
  public.admin_update_profile(uuid, text, public.user_role, boolean),
  public.calc_open_area_pct(public.hole_shape, public.hole_pattern, numeric, numeric)
to authenticated;

-- Needed by RLS policies, which run as the calling user
grant execute on function private.is_active_user(), private.is_super_user() to authenticated;
