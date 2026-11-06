-- =============================================================================
-- SHIBAAM INVENTORY — FULL FACTORY RESET (COMPLETE CLEAN SLATE)
-- =============================================================================
-- DEV / GO-LIVE ONLY — DESTRUCTIVE. Run in Supabase SQL Editor as postgres.
--
-- Use this to give your client a 100% clean, fresh production database ready
-- for live operation.
--
-- What it WIPES:
--   - All stock ledger movements, physical rolls, and stock balances
--   - All products, product_uoms, and perforation specifications
--   - All product categories
--   - Any product-specific custom conversion rules
--   - All audit log events
--
-- What it RESETS:
--   - Resets product_code_seq back to 1 (first created product will be SE-0001)
--
-- What it PRESERVES & ENSURES:
--   - User accounts & profiles (login credentials retained)
--   - Units of Measure (UOMs: ft, m, sqft, sqm, kg, roll, pcs, etc.)
--   - Global conversion rules (re-seeded / verified)
--   - SWG reference chart data
--   - App settings
-- =============================================================================

begin;

-- 1. Temporarily disable immutability triggers
alter table public.stock_movements disable trigger user;
alter table public.audit_events    disable trigger user;

-- 2. Wipe stock ledger and audit records
delete from public.stock_movements;
delete from public.stock_rolls;
delete from public.stock_balances;
delete from public.audit_events;

-- 3. Remove product-specific conversion rules (preserves global UOM conversion rules)
delete from public.conversion_rules where product_id is not null;

-- 4. Wipe product specifications and links
delete from public.product_perforation;
delete from public.product_uoms;

-- 5. Wipe products (uses DELETE instead of TRUNCATE CASCADE to protect conversion_rules)
delete from public.products;

-- 6. Wipe categories
delete from public.categories;

-- 7. Reset product code sequence back to 1 (starts fresh from SE-0001)
alter sequence if exists public.product_code_seq restart with 1;

-- 8. Ensure standard global conversion rules are fully restored
insert into public.conversion_rules (from_uom_id, to_uom_id, factor, version, is_active, source, notes)
select
  f.id, t.id, v.factor, 1, true, v.source, v.notes
from (
  values
    ('ft',   'm',    0.3048::numeric,                 'ISO standard: 1 ft = 0.3048 m',      'Feet to base meters'),
    ('m',    'ft',   3.28083989501312335958::numeric, 'Exact 1 / 0.3048',                   'Meters to base feet'),
    ('ft',   'in',   12::numeric,                     'Imperial standard: 1 ft = 12 in',    'Feet to base inches'),
    ('in',   'ft',   0.08333333333333333333::numeric, 'Exact 1 / 12',                       'Inches to base feet'),
    ('in',   'mm',   25.4::numeric,                   'ISO standard: 1 in = 25.4 mm',       'Inches to base millimeters'),
    ('mm',   'in',   0.03937007874015748031::numeric, 'Exact 1 / 25.4',                     'Millimeters to base inches'),
    ('mm',   'm',    0.001::numeric,                  'Metric standard: 1 mm = 0.001 m',    'Millimeters to base meters'),
    ('m',    'mm',   1000::numeric,                   'Metric standard: 1 m = 1000 mm',     'Meters to base millimeters'),
    ('sqft', 'sqm',  0.09290304::numeric,             'Exact 0.3048^2 m²',                  'Square feet to base square meters'),
    ('sqm',  'sqft', 10.763910416709722308::numeric,  'Exact 1 / 0.09290304',               'Square meters to base square feet')
) as v(from_code, to_code, factor, source, notes)
join public.uoms f on f.code = v.from_code
join public.uoms t on t.code = v.to_code
where not exists (
  select 1 from public.conversion_rules cr
   where cr.from_uom_id = f.id
     and cr.to_uom_id = t.id
     and cr.version = 1
     and cr.product_id is null
);

-- 9. Re-enable immutability triggers
alter table public.stock_movements enable trigger user;
alter table public.audit_events    enable trigger user;

commit;

-- Verification:
select 
  (select count(*) from public.categories) as categories_count,
  (select count(*) from public.products) as products_count,
  (select count(*) from public.stock_movements) as movements_count,
  (select count(*) from public.stock_rolls) as rolls_count,
  (select count(*) from public.stock_balances) as balances_count,
  (select count(*) from public.audit_events) as audits_count,
  (select count(*) from public.conversion_rules where product_id is null) as global_conversion_rules_count,
  (select last_value from pg_sequences where sequencename = 'product_code_seq') as next_product_code_seq;
