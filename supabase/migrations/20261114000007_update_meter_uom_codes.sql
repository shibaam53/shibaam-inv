-- Migration: Update unit of measure codes for Meter and Square Meter
-- 'm'   -> 'mtr'   (Meter, dimension: length)
-- 'sqm' -> 'sqmtr' (Square meter, dimension: area)

update public.uoms
set code = 'mtr'
where code = 'm';

update public.uoms
set code = 'sqmtr'
where code = 'sqm';

