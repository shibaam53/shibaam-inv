-- =============================================================================
-- SHIBAAM INVENTORY — RESET TRANSACTIONS (KEEP PRODUCTS & CATEGORIES)
-- =============================================================================
-- DEV / GO-LIVE ONLY — DESTRUCTIVE. Run in Supabase SQL Editor as postgres.
--
-- What it WIPES:
--   - All stock movements (ledger entries)
--   - All physical rolls and cuts (stock_rolls)
--   - All audit log events (audit_events)
--
-- What it RESETS:
--   - All stock balances in stock_balances back to 0.00
--
-- What it KEEPS:
--   - User accounts and profiles
--   - All products, specs, and configurations
--   - All categories
--   - All UOMs, conversion rules, SWG charts, and settings
-- =============================================================================

begin;

-- 1. Temporarily disable immutability triggers on ledger and audit tables
alter table public.stock_movements disable trigger user;
alter table public.audit_events    disable trigger user;

-- 2. Wipe transaction history and physical roll cuts
truncate table public.stock_movements restart identity cascade;
truncate table public.stock_rolls restart identity cascade;
truncate table public.audit_events restart identity;

-- 3. Reset all stock balances to zero
update public.stock_balances 
set quantity = 0, 
    updated_at = now();

-- 4. Re-enable immutability triggers
alter table public.stock_movements enable trigger user;
alter table public.audit_events    enable trigger user;

commit;

-- Verification:
select 
  (select count(*) from public.stock_movements) as remaining_movements,
  (select count(*) from public.stock_rolls) as remaining_rolls,
  (select count(*) from public.audit_events) as remaining_audits,
  (select coalesce(sum(quantity), 0) from public.stock_balances) as total_stock_balance,
  (select count(*) from public.products) as total_products_kept,
  (select count(*) from public.categories) as total_categories_kept;
