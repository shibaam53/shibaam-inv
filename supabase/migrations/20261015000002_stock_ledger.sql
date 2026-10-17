-- =============================================================================
-- Shibaam | Migration 2: stock balances, rolls, immutable ledger, stock RPCs
--
-- Rules enforced here (see AGENTS.md §3.1):
--   * clients never write these tables; all changes go through the RPCs below
--   * every RPC is ONE transaction: lock balance row -> validate -> write ledger -> update balance
--   * negative stock is rejected by the database
--   * stock_movements is append-only (privileges revoked + triggers)
--   * bill_status is mandatory on add/remove and is only a tag (balances are never split)
-- =============================================================================

create table public.stock_balances (
  product_id  uuid primary key references public.products (id) on delete restrict,
  quantity    numeric not null default 0 check (quantity >= 0),   -- in the product's base UOM
  updated_at  timestamptz not null default now()
);

create function private.create_balance_row()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.stock_balances (product_id) values (new.id);
  return new;
end $$;
create trigger products_create_balance after insert on public.products
  for each row execute function private.create_balance_row();

-- Individual roll records (only used by products with tracking_mode = 'roll').
create table public.stock_rolls (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete restrict,
  label          text not null check (length(trim(label)) > 0),
  initial_qty    numeric not null check (initial_qty > 0),   -- measured, in base UOM
  remaining_qty  numeric not null check (remaining_qty >= 0),
  status         public.roll_status not null default 'in_stock',
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  unique (product_id, label)
);
create index stock_rolls_product_idx on public.stock_rolls (product_id, status);

-- The ledger. qty_delta is signed and always expressed in the product's base UOM.
create table public.stock_movements (
  id                      uuid primary key default gen_random_uuid(),
  product_id              uuid not null references public.products (id) on delete restrict,
  movement_type           public.movement_type not null,
  bill_status             public.bill_status,
  qty_delta               numeric not null check (qty_delta <> 0),
  entered_qty             numeric not null check (entered_qty <> 0),
  entered_uom_id          uuid not null references public.uoms (id) on delete restrict,
  measured_base_qty       numeric,
  conversion_rule_id      uuid references public.conversion_rules (id) on delete restrict,
  conversion_rule_version integer,
  conversion_factor       numeric,
  balance_before          numeric not null check (balance_before >= 0),
  balance_after           numeric not null check (balance_after >= 0),
  roll_id                 uuid references public.stock_rolls (id) on delete restrict,
  reason                  text,
  reference               text,
  reversed_movement_id    uuid references public.stock_movements (id) on delete restrict,
  created_by              uuid not null references public.profiles (id) on delete restrict,
  created_at              timestamptz not null default now(),
  constraint balance_math check (balance_after = balance_before + qty_delta),
  constraint bill_status_rule check (
       (movement_type in ('add', 'remove') and bill_status is not null)
    or (movement_type in ('opening', 'correction') and bill_status is null)
    or  movement_type = 'reversal'),
  constraint reason_rule check (
    movement_type not in ('correction', 'reversal') or length(trim(coalesce(reason, ''))) > 0),
  constraint reversal_link check ((movement_type = 'reversal') = (reversed_movement_id is not null)),
  constraint inflow_positive check (movement_type not in ('opening', 'add') or qty_delta > 0),
  constraint remove_negative check (movement_type <> 'remove' or qty_delta < 0)
);
create unique index stock_movements_one_reversal
  on public.stock_movements (reversed_movement_id) where reversed_movement_id is not null;
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_user_idx on public.stock_movements (created_by, created_at desc);
create index stock_movements_roll_idx on public.stock_movements (roll_id) where roll_id is not null;
create index stock_movements_uom_idx on public.stock_movements (entered_uom_id);
create index stock_movements_rule_idx on public.stock_movements (conversion_rule_id)
  where conversion_rule_id is not null;

-- Append-only ledger: no UPDATE / DELETE / TRUNCATE, even for the table owner's app code.
create trigger stock_movements_append_only before update or delete on public.stock_movements
  for each row execute function private.block_mutation();
create trigger stock_movements_no_truncate before truncate on public.stock_movements
  for each statement execute function private.block_mutation();

create trigger audit_stock_rolls after insert or update on public.stock_rolls
  for each row execute function private.audit_row('id');

-- ----------------------------------------------------- identity locks -------
-- Once a product has movements, its stock unit, tracking mode and perforation
-- identity fields cannot change (a different pitch = a different product).
create function private.lock_product_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.base_uom_id <> old.base_uom_id or new.tracking_mode <> old.tracking_mode)
     and exists (select 1 from public.stock_movements m where m.product_id = old.id) then
    raise exception 'product_locked: base unit and tracking mode cannot change after stock movements'
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger products_lock_identity before update on public.products
  for each row execute function private.lock_product_identity();

create function private.lock_perforation_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.stock_movements m where m.product_id = old.product_id)
     and (tg_op = 'DELETE'
          or new.hole_shape <> old.hole_shape
          or new.hole_pattern <> old.hole_pattern
          or new.hole_diameter_mm <> old.hole_diameter_mm
          or new.pitch_mm <> old.pitch_mm
          or new.thickness_mm is distinct from old.thickness_mm) then
    raise exception 'product_locked: perforation specs cannot change after stock movements'
      using errcode = '23514';
  end if;
  return coalesce(new, old);
end $$;
create trigger product_perforation_lock before update or delete on public.product_perforation
  for each row execute function private.lock_perforation_identity();

-- ------------------------------------------------------ internal helpers ----
-- Lock the product's balance row; serialises every movement for that product.
create function private.lock_balance(p_product_id uuid)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_qty numeric;
begin
  select b.quantity into v_qty
  from public.stock_balances b where b.product_id = p_product_id for update;
  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  return v_qty;
end $$;

-- Entered quantity + UOM -> authoritative base quantity. NEVER invents a conversion:
--   base UOM            -> factor 1
--   measured UOM        -> the caller must supply the actual measured base quantity
--   anything else       -> an ACTIVE conversion rule is required, otherwise error
-- No rounding: numeric multiplication keeps full precision.
create function private.resolve_base_qty(
  p_product_id uuid, p_uom_id uuid, p_entered numeric, p_measured numeric,
  out o_base_qty numeric, out o_rule_id uuid, out o_rule_version integer, out o_factor numeric
) returns record language plpgsql stable security definer set search_path = '' as $$
declare
  v_base_uom uuid;
  v_requires boolean;
  v_rule record;
begin
  if p_entered is null or p_entered <= 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  select p.base_uom_id into v_base_uom from public.products p where p.id = p_product_id;

  if p_uom_id = v_base_uom then
    o_base_qty := p_entered;
    o_factor := 1;
    return;
  end if;

  select pu.requires_measurement into v_requires
  from public.product_uoms pu where pu.product_id = p_product_id and pu.uom_id = p_uom_id;
  if not found then
    raise exception 'uom_not_permitted' using errcode = '22023';
  end if;

  if v_requires then
    if p_measured is null or p_measured <= 0 then
      raise exception 'measurement_required' using errcode = '22023';
    end if;
    o_base_qty := p_measured;
    return;
  end if;

  select r.id, r.version, r.factor into v_rule
  from public.conversion_rules r
  where r.is_active
    and r.from_uom_id = p_uom_id and r.to_uom_id = v_base_uom
    and (r.product_id = p_product_id or r.product_id is null)
  order by (r.product_id is null)      -- product-specific rule first
  limit 1;
  if not found then
    raise exception 'no_active_conversion' using errcode = '22023';
  end if;

  o_base_qty := p_entered * v_rule.factor;
  o_rule_id := v_rule.id;
  o_rule_version := v_rule.version;
  o_factor := v_rule.factor;
end $$;

-- Adjust one roll by a signed delta (locks the roll row).
create function private.apply_roll_delta(p_roll_id uuid, p_product_id uuid, p_delta numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_remaining numeric;
  v_status public.roll_status;
  v_new numeric;
begin
  select r.remaining_qty, r.status into v_remaining, v_status
  from public.stock_rolls r where r.id = p_roll_id and r.product_id = p_product_id for update;
  if not found then
    raise exception 'roll_not_found' using errcode = 'P0002';
  end if;
  if v_status = 'voided' then
    raise exception 'roll_voided' using errcode = '23514';
  end if;
  v_new := v_remaining + p_delta;
  if v_new < 0 then
    raise exception 'insufficient_roll_stock' using errcode = '23514';
  end if;
  update public.stock_rolls
     set remaining_qty = v_new,
         status = case when v_new = 0 then 'consumed'::public.roll_status
                       else 'in_stock'::public.roll_status end
   where id = p_roll_id;
end $$;

-- The single place that writes the ledger and the balance.
create function private.record_movement(
  p_product_id uuid, p_type public.movement_type, p_bill public.bill_status,
  p_delta numeric, p_entered numeric, p_uom_id uuid, p_measured numeric,
  p_rule_id uuid, p_rule_version integer, p_factor numeric,
  p_balance_before numeric, p_roll_id uuid, p_reason text, p_reference text,
  p_reversed uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_after numeric := p_balance_before + p_delta;
  v_id uuid;
begin
  if v_after < 0 then
    raise exception 'insufficient_stock' using errcode = '23514';
  end if;
  insert into public.stock_movements (
    product_id, movement_type, bill_status, qty_delta, entered_qty, entered_uom_id,
    measured_base_qty, conversion_rule_id, conversion_rule_version, conversion_factor,
    balance_before, balance_after, roll_id, reason, reference, reversed_movement_id, created_by)
  values (
    p_product_id, p_type, p_bill, p_delta, p_entered, p_uom_id,
    p_measured, p_rule_id, p_rule_version, p_factor,
    p_balance_before, v_after, p_roll_id, nullif(trim(p_reason), ''), nullif(trim(p_reference), ''),
    p_reversed, (select auth.uid()))
  returning id into v_id;
  update public.stock_balances
     set quantity = v_after, updated_at = now()
   where product_id = p_product_id;
  return v_id;
end $$;

-- ------------------------------------------------------------- public RPCs --
-- Quantities are numeric. The client must send them as STRINGS ("12.345") so no
-- JavaScript float ever reaches the database.

create function public.add_stock(
  p_product_id uuid, p_entered_qty numeric, p_uom_id uuid, p_bill_status public.bill_status,
  p_measured_base_qty numeric default null, p_roll_label text default null,
  p_reference text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_prod public.products;
  v_bal numeric;
  v_res record;
  v_roll uuid;
begin
  perform private.require_active_user();
  if p_bill_status is null then
    raise exception 'bill_status_required' using errcode = '23502';
  end if;
  select * into v_prod from public.products where id = p_product_id;
  if not found then raise exception 'product_not_found' using errcode = 'P0002'; end if;
  if v_prod.status <> 'active' then raise exception 'product_archived' using errcode = '23514'; end if;

  v_bal := private.lock_balance(p_product_id);
  select * into v_res from private.resolve_base_qty(p_product_id, p_uom_id, p_entered_qty, p_measured_base_qty);

  if v_prod.tracking_mode = 'roll' then
    if p_roll_label is null or length(trim(p_roll_label)) = 0 then
      raise exception 'roll_label_required' using errcode = '23502';
    end if;
    insert into public.stock_rolls (product_id, label, initial_qty, remaining_qty, created_by)
    values (p_product_id, trim(p_roll_label), v_res.o_base_qty, v_res.o_base_qty, (select auth.uid()))
    returning id into v_roll;
  end if;

  return private.record_movement(
    p_product_id, 'add', p_bill_status, v_res.o_base_qty, p_entered_qty, p_uom_id,
    p_measured_base_qty, v_res.o_rule_id, v_res.o_rule_version, v_res.o_factor,
    v_bal, v_roll, null, p_reference, null);
end $$;

create function public.remove_stock(
  p_product_id uuid, p_entered_qty numeric, p_uom_id uuid, p_bill_status public.bill_status,
  p_measured_base_qty numeric default null, p_roll_id uuid default null,
  p_reference text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_prod public.products;
  v_bal numeric;
  v_res record;
begin
  perform private.require_active_user();
  if p_bill_status is null then
    raise exception 'bill_status_required' using errcode = '23502';
  end if;
  select * into v_prod from public.products where id = p_product_id;
  if not found then raise exception 'product_not_found' using errcode = 'P0002'; end if;
  if v_prod.status <> 'active' then raise exception 'product_archived' using errcode = '23514'; end if;

  v_bal := private.lock_balance(p_product_id);
  select * into v_res from private.resolve_base_qty(p_product_id, p_uom_id, p_entered_qty, p_measured_base_qty);

  if v_prod.tracking_mode = 'roll' then
    if p_roll_id is null then
      raise exception 'roll_required' using errcode = '23502';
    end if;
    perform private.apply_roll_delta(p_roll_id, p_product_id, -v_res.o_base_qty);
  end if;

  return private.record_movement(
    p_product_id, 'remove', p_bill_status, -v_res.o_base_qty, p_entered_qty, p_uom_id,
    p_measured_base_qty, v_res.o_rule_id, v_res.o_rule_version, v_res.o_factor,
    v_bal, p_roll_id, null, p_reference, null);
end $$;

-- Super User only. Allowed only while the product has nothing but opening entries.
-- Aggregate products: one opening entry. Roll products: one opening entry per roll.
create function public.set_opening_stock(
  p_product_id uuid, p_entered_qty numeric, p_uom_id uuid,
  p_measured_base_qty numeric default null, p_roll_label text default null,
  p_reference text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_prod public.products;
  v_bal numeric;
  v_res record;
  v_roll uuid;
begin
  perform private.require_super_user();
  select * into v_prod from public.products where id = p_product_id;
  if not found then raise exception 'product_not_found' using errcode = 'P0002'; end if;
  if v_prod.status <> 'active' then raise exception 'product_archived' using errcode = '23514'; end if;

  v_bal := private.lock_balance(p_product_id);
  if exists (select 1 from public.stock_movements m
             where m.product_id = p_product_id and m.movement_type <> 'opening') then
    raise exception 'opening_not_allowed: product already has stock activity' using errcode = '23514';
  end if;
  if v_prod.tracking_mode = 'aggregate'
     and exists (select 1 from public.stock_movements m
                 where m.product_id = p_product_id and m.movement_type = 'opening') then
    raise exception 'opening_already_set' using errcode = '23514';
  end if;

  select * into v_res from private.resolve_base_qty(p_product_id, p_uom_id, p_entered_qty, p_measured_base_qty);

  if v_prod.tracking_mode = 'roll' then
    if p_roll_label is null or length(trim(p_roll_label)) = 0 then
      raise exception 'roll_label_required' using errcode = '23502';
    end if;
    insert into public.stock_rolls (product_id, label, initial_qty, remaining_qty, created_by)
    values (p_product_id, trim(p_roll_label), v_res.o_base_qty, v_res.o_base_qty, (select auth.uid()))
    returning id into v_roll;
  end if;

  return private.record_movement(
    p_product_id, 'opening', null, v_res.o_base_qty, p_entered_qty, p_uom_id,
    p_measured_base_qty, v_res.o_rule_id, v_res.o_rule_version, v_res.o_factor,
    v_bal, v_roll, null, p_reference, null);
end $$;

-- Super User only. Signed delta in the product's BASE UOM. Reason is mandatory.
create function public.correct_stock(
  p_product_id uuid, p_delta_base_qty numeric, p_reason text, p_roll_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_prod public.products;
  v_bal numeric;
begin
  perform private.require_super_user();
  if p_delta_base_qty is null or p_delta_base_qty = 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason_required' using errcode = '23502';
  end if;
  select * into v_prod from public.products where id = p_product_id;
  if not found then raise exception 'product_not_found' using errcode = 'P0002'; end if;

  v_bal := private.lock_balance(p_product_id);
  if v_prod.tracking_mode = 'roll' then
    if p_roll_id is null then
      raise exception 'roll_required' using errcode = '23502';
    end if;
    perform private.apply_roll_delta(p_roll_id, p_product_id, p_delta_base_qty);
  end if;

  return private.record_movement(
    p_product_id, 'correction', null, p_delta_base_qty, p_delta_base_qty, v_prod.base_uom_id,
    null, null, null, null, v_bal, p_roll_id, p_reason, null, null);
end $$;

-- Super User only. Appends the opposite movement (history is never edited). One reversal per movement.
create function public.reverse_stock_movement(p_movement_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_mv public.stock_movements;
  v_prod public.products;
  v_bal numeric;
  v_delta numeric;
  v_roll public.stock_rolls;
begin
  perform private.require_super_user();
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason_required' using errcode = '23502';
  end if;
  select * into v_mv from public.stock_movements where id = p_movement_id;
  if not found then raise exception 'movement_not_found' using errcode = 'P0002'; end if;
  if v_mv.movement_type = 'reversal' then
    raise exception 'cannot_reverse_a_reversal' using errcode = '23514';
  end if;

  select * into v_prod from public.products where id = v_mv.product_id;
  v_bal := private.lock_balance(v_mv.product_id);
  if exists (select 1 from public.stock_movements m where m.reversed_movement_id = p_movement_id) then
    raise exception 'already_reversed' using errcode = '23514';
  end if;

  v_delta := -v_mv.qty_delta;

  if v_mv.roll_id is not null then
    if v_mv.movement_type in ('opening', 'add') then
      -- Reversing the creation of a roll is only possible while it is untouched.
      select * into v_roll from public.stock_rolls where id = v_mv.roll_id for update;
      if v_roll.remaining_qty <> v_roll.initial_qty or v_roll.status <> 'in_stock' then
        raise exception 'roll_already_used' using errcode = '23514';
      end if;
      update public.stock_rolls set remaining_qty = 0, status = 'voided' where id = v_mv.roll_id;
    else
      perform private.apply_roll_delta(v_mv.roll_id, v_mv.product_id, v_delta);
    end if;
  end if;

  return private.record_movement(
    v_mv.product_id, 'reversal', v_mv.bill_status, v_delta, v_delta, v_prod.base_uom_id,
    null, null, null, null, v_bal, v_mv.roll_id, p_reason, null, p_movement_id);
end $$;

-- Super User only. Cannot change your own role/active flag; at least one active
-- Super User must always remain.
create function public.admin_update_profile(
  p_user_id uuid, p_full_name text default null,
  p_role public.user_role default null, p_is_active boolean default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cur public.profiles;
begin
  perform private.require_super_user();
  select * into v_cur from public.profiles where id = p_user_id;
  if not found then raise exception 'user_not_found' using errcode = 'P0002'; end if;
  if p_user_id = (select auth.uid())
     and ((p_role is not null and p_role <> v_cur.role) or p_is_active is false) then
    raise exception 'cannot_change_own_access' using errcode = '42501';
  end if;
  update public.profiles
     set full_name = coalesce(p_full_name, full_name),
         role      = coalesce(p_role, role),
         is_active = coalesce(p_is_active, is_active)
   where id = p_user_id;
  if not exists (select 1 from public.profiles where role = 'super_user' and is_active) then
    raise exception 'last_super_user' using errcode = '23514';
  end if;
end $$;
