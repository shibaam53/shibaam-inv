-- Run ONCE in the Supabase SQL Editor after creating your first user.
-- 1) Dashboard > Authentication > Users > "Add user" (email + password, tick "Auto Confirm User").
-- 2) Put that email below and run this script.
update public.profiles
   set role = 'super_user', is_active = true, full_name = coalesce(nullif(full_name, ''), 'Super User')
 where id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');

-- Check: should return exactly one row with role = super_user
select p.id, u.email, p.role, p.is_active
  from public.profiles p join auth.users u on u.id = p.id
 where p.role = 'super_user';
