-- Migration: 20261017000004_swg_reference.sql
-- Description: Standard Wire Gauge (SWG) lookup scale and helper functions (Phase 5).
--
-- Compliance with AGENTS.md §3.3 & SRS §21.6:
-- 1. SWG is a reference lookup scale, never a linear unit or multiplier.
-- 2. Values are stored at full numeric precision (no floating-point, no rounding).
-- 3. Strict RLS: active users can read; Super User can manage.
-- 4. Full audit trail via private.audit_row('id').

create table public.swg_reference (
  id             uuid primary key default gen_random_uuid(),
  gauge          text not null unique check (length(trim(gauge)) > 0),
  sort_order     integer not null unique,
  diameter_mm    numeric not null check (diameter_mm > 0),
  diameter_inch  numeric not null check (diameter_inch > 0),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index swg_reference_sort_idx on public.swg_reference (sort_order);

create trigger swg_reference_updated_at before update on public.swg_reference
  for each row execute function private.set_updated_at();

create trigger audit_swg_reference after insert or update or delete on public.swg_reference
  for each row execute function private.audit_row('id');

-- RLS
alter table public.swg_reference enable row level security;
revoke all on public.swg_reference from public, anon;
grant select on public.swg_reference to authenticated;
grant insert, update, delete on public.swg_reference to authenticated;

create policy swg_reference_select on public.swg_reference
  for select to authenticated
  using ((select private.is_active_user()));

create policy swg_reference_insert on public.swg_reference
  for insert to authenticated
  with check ((select private.is_super_user()));

create policy swg_reference_update on public.swg_reference
  for update to authenticated
  using ((select private.is_super_user()))
  with check ((select private.is_super_user()));

create policy swg_reference_delete on public.swg_reference
  for delete to authenticated
  using ((select private.is_super_user()));

-- Helper lookup function
create or replace function public.lookup_swg(p_gauge text)
returns table (
  gauge text,
  diameter_mm numeric,
  diameter_inch numeric
) language sql stable security definer set search_path = '' as $$
  select s.gauge, s.diameter_mm, s.diameter_inch
    from public.swg_reference s
   where lower(trim(s.gauge)) = lower(trim(p_gauge))
     and (select private.is_active_user());
$$;

revoke all on function public.lookup_swg(text) from public, anon;
grant execute on function public.lookup_swg(text) to authenticated;
