-- =============================================================================
-- Seed: Standard UOM Conversion Rules
-- Defines authoritative full-precision conversion factors between compatible units.
-- In accordance with AGENTS.md §3.2 & §3.3:
--   - Exact mathematical factors (e.g. 1 / 0.3048, not rounded 3.281).
--   - Idempotent: safe to run multiple times without duplicating or failing.
--   - Populates rules for length and area units with is_active = true.
-- =============================================================================

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
