-- Migration: 20261017000005_product_gauge.sql
-- Description: Add optional gauge column to products referencing swg_reference(gauge).

alter table public.products
  add column if not exists gauge text references public.swg_reference (gauge) on update cascade on delete set null;

create index if not exists products_gauge_idx on public.products (gauge);

-- Update inventory_overview view to include gauge
drop view if exists public.inventory_overview;

create view public.inventory_overview with (security_invoker = true) as
select
  p.id            as product_id,
  p.code,
  p.name,
  p.category_id,
  c.name          as category_name,
  p.status,
  p.tracking_mode,
  p.gauge,
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

grant select on public.inventory_overview to authenticated;
