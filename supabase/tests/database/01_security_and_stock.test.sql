-- pgTAP tests: authorization (allowed AND denied), stock RPCs, ledger, conversions, pitch/open area.
-- Run: npx supabase test db   (local stack, Docker)   -- see README for the hosted-project option.
begin;
create extension if not exists pgtap with schema extensions;
select plan(76);

-- ================================================================= fixtures ==
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'super@test.local'),
  ('00000000-0000-0000-0000-000000000002', 'normal@test.local'),
  ('00000000-0000-0000-0000-000000000003', 'inactive@test.local'),
  ('00000000-0000-0000-0000-000000000004', 'victim@test.local');
update public.profiles set role = 'super_user' where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set is_active = false   where id = '00000000-0000-0000-0000-000000000003';

insert into public.products (id, code, name, base_uom_id, tracking_mode) values
  ('a0000000-0000-0000-0000-000000000001', 'AGG-1', 'Aggregate product',
     (select id from public.uoms where code = 'm'), 'aggregate'),
  ('a0000000-0000-0000-0000-000000000002', 'ROLL-1', 'Roll product',
     (select id from public.uoms where code = 'm'), 'roll'),
  ('a0000000-0000-0000-0000-000000000003', 'PERF-1', 'Perforated sheet',
     (select id from public.uoms where code = 'sqm'), 'aggregate');
insert into public.products (id, code, name, base_uom_id, status) values
  ('a0000000-0000-0000-0000-000000000004', 'OLD-1', 'Archived product',
     (select id from public.uoms where code = 'm'), 'archived');

insert into public.product_uoms (product_id, uom_id, requires_measurement) values
  ('a0000000-0000-0000-0000-000000000001', (select id from public.uoms where code = 'ft'), false),
  ('a0000000-0000-0000-0000-000000000001', (select id from public.uoms where code = 'roll'), true);

-- ============================================================ structure ======
select is((select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0,
  'RLS is enabled on every table in public');

select is((select count(*)::int from public.stock_balances), 4, 'a balance row is created for every product');

-- ===================================================================== anon ===
set local role anon;
select throws_ok($$ select * from public.products $$, '42501', null, 'anon cannot read products');
select throws_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000001', '1',
  (select id from public.uoms where code = 'm'), 'with_bill') $$, '42501', null, 'anon cannot call add_stock');
reset role;

-- =============================================================== normal user ==
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true); end $$;
set local role authenticated;

select is((select count(*)::int from public.products), 4, 'normal user can read products');
select throws_ok($$ insert into public.products (code, name, base_uom_id)
  values ('X', 'X', (select id from public.uoms where code = 'm')) $$, '42501', null,
  'normal user cannot create products');
select throws_ok($$ update public.profiles set role = 'super_user'
  where id = '00000000-0000-0000-0000-000000000002' $$, '42501', null,
  'normal user cannot promote themselves');
select throws_ok($$ insert into public.conversion_rules (from_uom_id, to_uom_id, factor)
  values ((select id from public.uoms where code = 'ft'), (select id from public.uoms where code = 'm'), 1) $$,
  '42501', null, 'normal user cannot create conversion rules');
select throws_ok($$ select public.set_opening_stock('a0000000-0000-0000-0000-000000000001', '100',
  (select id from public.uoms where code = 'm')) $$, '42501', 'not_authorized',
  'normal user cannot set opening stock');
select throws_ok($$ select public.correct_stock('a0000000-0000-0000-0000-000000000001', '5', 'x') $$,
  '42501', 'not_authorized', 'normal user cannot correct stock');
select throws_ok($$ update public.stock_balances set quantity = 999 $$, '42501', null,
  'normal user cannot write balances directly');
select throws_ok($$ insert into public.stock_movements (product_id, movement_type, bill_status, qty_delta,
  entered_qty, entered_uom_id, balance_before, balance_after, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'add', 'with_bill', 1, 1,
  (select id from public.uoms where code = 'm'), 0, 1, '00000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'normal user cannot write the ledger directly');
reset role;

-- ================================================================ super user ==
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true); end $$;
set local role authenticated;
select lives_ok($$ select public.set_opening_stock('a0000000-0000-0000-0000-000000000001', '100',
  (select id from public.uoms where code = 'm'), null, null, 'opening count') $$,
  'super user can set opening stock');
select is((select quantity from public.stock_balances where product_id = 'a0000000-0000-0000-0000-000000000001'),
  100::numeric, 'opening stock sets the balance');
select is((select bill_status::text from public.stock_movements where movement_type = 'opening' limit 1), null,
  'opening stock has no bill status');
reset role;

-- ============================================ normal user: add / remove ======
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true); end $$;
set local role authenticated;

select throws_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000001', '5',
  (select id from public.uoms where code = 'm'), null) $$, '23502', 'bill_status_required',
  'add_stock rejects a missing bill status');
select throws_ok($$ select public.remove_stock('a0000000-0000-0000-0000-000000000001', '5',
  (select id from public.uoms where code = 'm'), null) $$, '23502', 'bill_status_required',
  'remove_stock rejects a missing bill status');
select lives_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000001', '50',
  (select id from public.uoms where code = 'm'), 'with_bill') $$, 'normal user can add stock with bill');
select is((select quantity from public.stock_balances where product_id = 'a0000000-0000-0000-0000-000000000001'),
  150::numeric, 'balance increased by 50');
select lives_ok($$ select public.remove_stock('a0000000-0000-0000-0000-000000000001', '30',
  (select id from public.uoms where code = 'm'), 'without_bill') $$, 'normal user can remove stock without bill');
select is((select quantity from public.stock_balances where product_id = 'a0000000-0000-0000-0000-000000000001'),
  120::numeric, 'balance decreased by 30 (bill status does not split stock)');
select throws_ok($$ select public.remove_stock('a0000000-0000-0000-0000-000000000001', '500',
  (select id from public.uoms where code = 'm'), 'with_bill') $$, '23514', 'insufficient_stock',
  'negative stock is rejected');
select throws_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000001', '-5',
  (select id from public.uoms where code = 'm'), 'with_bill') $$, '22023', 'invalid_quantity',
  'negative quantity input is rejected');
select throws_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000004', '5',
  (select id from public.uoms where code = 'm'), 'with_bill') $$, '23514', 'product_archived',
  'archived products cannot be moved');
select throws_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000001', '5',
  (select id from public.uoms where code = 'kg'), 'with_bill') $$, '22023', 'uom_not_permitted',
  'a UOM that is not permitted for the product is rejected');
select is((select count(*)::int from public.stock_movements), 2, 'normal user sees only their own movements');
select is((select bill_status::text from public.stock_movements where qty_delta = -30), 'without_bill',
  'bill status is stored on the ledger');
reset role;

-- ================================================================ conversions ==
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true); end $$;
set local role authenticated;
select throws_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000001', '10',
  (select id from public.uoms where code = 'ft'), 'with_bill') $$, '22023', 'no_active_conversion',
  'no conversion is ever invented when no rule exists');
reset role;

-- Test-only factor (the real factors are pending client verification).
insert into public.conversion_rules (id, from_uom_id, to_uom_id, factor)
values ('c0000000-0000-0000-0000-000000000001', (select id from public.uoms where code = 'ft'),
        (select id from public.uoms where code = 'm'), 0.3048);

do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true); end $$;
set local role authenticated;
select throws_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000001', '10',
  (select id from public.uoms where code = 'ft'), 'with_bill') $$, '22023', 'no_active_conversion',
  'an inactive conversion rule is not used');
reset role;

update public.conversion_rules set is_active = true where id = 'c0000000-0000-0000-0000-000000000001';
select throws_ok($$ update public.conversion_rules set factor = 1 where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'a conversion rule factor cannot be edited (new version required)');

do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true); end $$;
set local role authenticated;
select lives_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000001', '10',
  (select id from public.uoms where code = 'ft'), 'with_bill') $$, 'an active rule converts feet to base meters');
select is((select qty_delta from public.stock_movements where conversion_rule_id is not null),
  3.048::numeric, 'converted quantity keeps full precision (no rounding)');
select is((select conversion_factor from public.stock_movements where conversion_rule_id is not null),
  0.3048::numeric, 'the factor used is stored on the ledger');
select is((select conversion_rule_version from public.stock_movements where conversion_rule_id is not null),
  1, 'the rule version used is stored on the ledger');
select throws_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000001', '1',
  (select id from public.uoms where code = 'roll'), 'with_bill') $$, '22023', 'measurement_required',
  'a roll entry requires the actual measured quantity');
select lives_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000001', '1',
  (select id from public.uoms where code = 'roll'), 'without_bill', '25.5') $$,
  'a roll entry with a measured quantity is accepted');
select is((select quantity from public.stock_balances where product_id = 'a0000000-0000-0000-0000-000000000001'),
  148.548::numeric, 'balance = 120 + 3.048 + 25.5');
reset role;

-- ================================================================ roll tracking
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true); end $$;
set local role authenticated;
select throws_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000002', '40',
  (select id from public.uoms where code = 'm'), 'with_bill') $$, '23502', 'roll_label_required',
  'a roll product requires a roll label on add');
select lives_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000002', '40',
  (select id from public.uoms where code = 'm'), 'with_bill', null, 'R-001') $$, 'a roll is created on add');
select is((select remaining_qty from public.stock_rolls where label = 'R-001'), 40::numeric, 'roll holds the measured quantity');
select throws_ok($$ select public.remove_stock('a0000000-0000-0000-0000-000000000002', '5',
  (select id from public.uoms where code = 'm'), 'with_bill') $$, '23502', 'roll_required',
  'a roll product requires a roll on remove');
select lives_ok($$ select public.remove_stock('a0000000-0000-0000-0000-000000000002', '15',
  (select id from public.uoms where code = 'm'), 'with_bill', null,
  (select id from public.stock_rolls where label = 'R-001')) $$, 'remove consumes from a specific roll');
select throws_ok($$ select public.remove_stock('a0000000-0000-0000-0000-000000000002', '30',
  (select id from public.uoms where code = 'm'), 'with_bill', null,
  (select id from public.stock_rolls where label = 'R-001')) $$, '23514', 'insufficient_roll_stock',
  'cannot remove more than the roll holds');
select is((select remaining_qty from public.stock_rolls where label = 'R-001'), 25::numeric, 'roll remaining is 25');
reset role;

-- ====================================== corrections, reversals (super user) ==
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true); end $$;
set local role authenticated;
select throws_ok($$ select public.correct_stock('a0000000-0000-0000-0000-000000000001', '-5', '  ') $$,
  '23502', 'reason_required', 'a correction requires a reason');
select lives_ok($$ select public.correct_stock('a0000000-0000-0000-0000-000000000001', '-5', 'count mismatch') $$,
  'super user can correct stock with a reason');
select is((select quantity from public.stock_balances where product_id = 'a0000000-0000-0000-0000-000000000001'),
  143.548::numeric, 'correction changed the balance by -5');
select throws_ok($$ select public.set_opening_stock('a0000000-0000-0000-0000-000000000001', '5',
  (select id from public.uoms where code = 'm')) $$, '23514', 'opening_not_allowed: product already has stock activity',
  'opening stock is blocked once there is other activity');
select lives_ok($$ select public.reverse_stock_movement(
  (select id from public.stock_movements where qty_delta = -30), 'entered by mistake') $$,
  'super user can reverse a movement');
select is((select quantity from public.stock_balances where product_id = 'a0000000-0000-0000-0000-000000000001'),
  173.548::numeric, 'reversal appended the opposite movement');
select is((select bill_status::text from public.stock_movements where movement_type = 'reversal'), 'without_bill',
  'a reversal inherits the original bill status');
select throws_ok($$ select public.reverse_stock_movement(
  (select id from public.stock_movements where qty_delta = -30 and movement_type = 'remove'), 'again') $$,
  '23514', 'already_reversed', 'a movement can only be reversed once');
select throws_ok($$ select public.reverse_stock_movement(
  (select id from public.stock_movements where movement_type = 'reversal'), 'nope') $$,
  '23514', 'cannot_reverse_a_reversal', 'a reversal cannot be reversed');
select is((select count(*)::int from public.stock_movements), 9, 'super user sees every movement');
select cmp_ok((select count(*)::int from public.audit_events), '>', 0, 'super user can read the audit trail');
reset role;

-- ============================================================== immutability ==
select throws_ok($$ update public.stock_movements set reason = 'tamper' $$, '42501', null,
  'ledger rows cannot be updated, even by the owner role');
select throws_ok($$ delete from public.stock_movements $$, '42501', null, 'ledger rows cannot be deleted');
select throws_ok($$ truncate public.stock_movements $$, '42501', null, 'the ledger cannot be truncated');
select throws_ok($$ delete from public.audit_events $$, '42501', null, 'audit events cannot be deleted');

select is((select count(*)::int from public.stock_balances b
  where b.quantity <> coalesce((select sum(m.qty_delta) from public.stock_movements m where m.product_id = b.product_id), 0)),
  0, 'every balance equals the sum of its ledger');

-- ============================================================ identity locks ==
select throws_ok($$ update public.products set base_uom_id = (select id from public.uoms where code = 'kg')
  where id = 'a0000000-0000-0000-0000-000000000001' $$, '23514', null,
  'base unit is locked after stock movements');

-- =========================================== perforated sheets: pitch + open area
insert into public.product_perforation (product_id, hole_pattern, hole_diameter_mm, pitch_mm, thickness_mm)
values ('a0000000-0000-0000-0000-000000000003', 'staggered_60', 2, 4, 1.5);
select throws_ok($$ insert into public.product_perforation (product_id, hole_pattern, hole_diameter_mm, pitch_mm)
  values ('a0000000-0000-0000-0000-000000000001', 'staggered_60', 4, 4) $$, '23514', null,
  'pitch must be larger than the hole diameter');
select is((select open_area_pct from public.perforated_sheet_specs where product_id = 'a0000000-0000-0000-0000-000000000003'),
  null::numeric, 'open area is not shown until the client confirms the formula');
update public.open_area_formulas set is_active = true where hole_shape = 'round' and hole_pattern = 'staggered_60';
select is((select round(open_area_pct, 6) from public.perforated_sheet_specs where product_id = 'a0000000-0000-0000-0000-000000000003'),
  22.672492::numeric, 'open area, 60 degree staggered, d=2 p=4');
select is(round(public.calc_open_area_pct('round', 'straight_90', 2, 4), 6), 19.634954::numeric,
  'open area, 90 degree straight, d=2 p=4');
select is(public.calc_open_area_pct('round', 'other', 2, 4), null::numeric,
  'a pattern without an approved formula returns no open area');

do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true); end $$;
set local role authenticated;
select is((select pitch_mm from public.perforated_sheet_specs where product_id = 'a0000000-0000-0000-0000-000000000003'),
  4::numeric, 'normal user can read pitch');
reset role;

do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true); end $$;
set local role authenticated;
select lives_ok($$ select public.set_opening_stock('a0000000-0000-0000-0000-000000000003', '10',
  (select id from public.uoms where code = 'sqm')) $$, 'opening stock on the perforated product');
reset role;
select throws_ok($$ update public.product_perforation set pitch_mm = 5
  where product_id = 'a0000000-0000-0000-0000-000000000003' $$, '23514', null,
  'pitch is locked once the product has stock movements');

-- ========================================================== inactive / admin ==
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true); end $$;
set local role authenticated;
select is((select count(*)::int from public.products), 0, 'a deactivated user reads nothing');
select throws_ok($$ select public.add_stock('a0000000-0000-0000-0000-000000000001', '1',
  (select id from public.uoms where code = 'm'), 'with_bill') $$, '42501', 'not_authorized',
  'a deactivated user cannot move stock');
reset role;

do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true); end $$;
set local role authenticated;
select is((select count(*)::int from public.audit_events), 0, 'normal user cannot read the audit trail');
select throws_ok($$ select public.admin_update_profile('00000000-0000-0000-0000-000000000004', null, null, false) $$,
  '42501', 'not_authorized', 'normal user cannot manage users');
reset role;

do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true); end $$;
set local role authenticated;
select throws_ok($$ select public.admin_update_profile('00000000-0000-0000-0000-000000000001', null, null, false) $$,
  '42501', 'cannot_change_own_access', 'super user cannot deactivate themselves');
select lives_ok($$ select public.admin_update_profile('00000000-0000-0000-0000-000000000004', 'Victim', null, false) $$,
  'super user can deactivate another user');
reset role;
select is((select is_active from public.profiles where id = '00000000-0000-0000-0000-000000000004'), false,
  'the user is now inactive');

-- Result: when every test passes this returns no rows. Any row means something failed.
select * from finish();
rollback;
