-- =============================================================================
-- DEV ONLY - DESTRUCTIVE. Wipes ALL stock history so you can go live in the same
-- database after testing. Run in the Supabase SQL Editor (as postgres), once.
--
-- What it does : empties stock_movements, stock_rolls and audit_events, sets every
--                balance back to 0.
-- What it keeps: users/profiles, categories, products, UOMs, conversion rules,
--                perforation specs, settings.
-- Afterwards   : enter real opening stock with set_opening_stock().
-- NEVER run this on a database that holds real stock records.
-- =============================================================================
begin;

alter table public.stock_movements disable trigger user;
alter table public.audit_events    disable trigger user;

truncate table public.stock_movements, public.stock_rolls restart identity;
truncate table public.audit_events restart identity;
update public.stock_balances set quantity = 0, updated_at = now();

alter table public.stock_movements enable trigger user;
alter table public.audit_events    enable trigger user;

commit;
