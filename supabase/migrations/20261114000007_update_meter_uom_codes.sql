-- Migration: Update unit of measure codes for Meter and Square Meter
-- 'm'   -> 'mtr'   (Meter, dimension: length)
-- 'sqm' -> 'sqmtr' (Square meter, dimension: area)

-- 1. Update UOM table codes
update public.uoms
set code = 'mtr'
where code = 'm';

update public.uoms
set code = 'sqmtr'
where code = 'sqm';

-- 2. Update validate_product_paano() trigger function to accept 'mtr'
create or replace function private.validate_product_paano()
returns trigger
language plpgsql
as $$
begin
  if new.paano_value is null then
    new.paano_unit := null;
    new.paano_in_feet := null;
    return new;
  end if;

  if new.paano_value <= 0 then
    raise exception 'Paano value must be positive';
  end if;

  if new.paano_unit is null then
    raise exception 'Paano unit is required when paano value is set';
  end if;

  case lower(trim(new.paano_unit))
    when 'ft', 'feet' then
      new.paano_in_feet := new.paano_value;
    when 'in', 'inch', 'inches' then
      new.paano_in_feet := new.paano_value / 12.0;
    when 'mtr', 'm', 'meter', 'meters' then
      new.paano_in_feet := new.paano_value / 0.3048;
    when 'mm', 'millimeter', 'millimeters' then
      new.paano_in_feet := new.paano_value / 304.8;
    else
      raise exception 'Unsupported Paano unit: %', new.paano_unit;
  end case;

  return new;
end;
$$;

-- 3. Update products_paano_unit_check constraint to permit 'mtr'
alter table public.products
  drop constraint if exists products_paano_unit_check;

alter table public.products
  add constraint products_paano_unit_check
  check (
    paano_unit is null
    or paano_unit in ('ft', 'in', 'm', 'mtr', 'mm')
  );

-- 4. Update existing products with legacy 'm' paano unit to 'mtr'
update public.products
set paano_unit = 'mtr'
where paano_unit = 'm';



