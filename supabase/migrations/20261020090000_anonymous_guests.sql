-- Anonymous guests (Supabase anonymous sign-ins)
--
-- A visitor without an account gets an anonymous Supabase user on their first
-- Add to Bag, so their bag lives in public.cart_items under the same owner-only
-- row level security as a customer's (nothing is stored in the browser except
-- Supabase's own session). Anonymous users share the `authenticated` role with
-- customers, so this migration keeps them out of everything that belongs to a
-- customer account:
--
-- - no profile is created for them;
-- - restrictive policies deny them profiles, addresses, orders and order items;
-- - order requests cannot be saved for them, even through the security
--   definer create_order_request (it bypasses row level security);
-- - their bag (cart_items) works exactly as before.
--
-- An anonymous session carries the JWT claim is_anonymous = true. Customers'
-- sessions carry false; the dashboard and service role carry no claims, and
-- `is distinct from 'true'` treats both as not anonymous.
--
-- Apply this BEFORE enabling "Allow anonymous sign-ins" in the dashboard.

begin;

-- 1. No customer profile for anonymous users (same function as
--    20261009100000_customer_profiles.sql, plus the first check).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_anonymous then
    return new;
  end if;
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), 80),
    left(btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2. Customer data is for customers only. Restrictive policies are combined
--    with AND, so the existing owner-only policies still apply on top.
create policy "Anonymous guests have no profile"
  on public.profiles as restrictive for all to authenticated
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true')
  with check ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true');

create policy "Anonymous guests have no addresses"
  on public.addresses as restrictive for all to authenticated
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true')
  with check ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true');

create policy "Anonymous guests have no orders"
  on public.orders as restrictive for all to authenticated
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true')
  with check ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true');

create policy "Anonymous guests have no order items"
  on public.order_items as restrictive for all to authenticated
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true')
  with check ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true');

-- 3. create_order_request runs as its owner and bypasses row level security,
--    so the orders table itself refuses an anonymous caller. Guests still
--    send order requests by WhatsApp / email; only account history is skipped.
create function public.orders_reject_anonymous()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.jwt() ->> 'is_anonymous') = 'true' then
    raise exception 'anonymous_not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger orders_reject_anonymous
  before insert or update on public.orders
  for each row execute function public.orders_reject_anonymous();

revoke execute on function public.orders_reject_anonymous() from public, anon, authenticated;

-- 4. Housekeeping. A guest who signs in keeps their lines (the app adds them
--    to the account), but the anonymous user and its rows stay behind; so do
--    abandoned guest bags. This removes anonymous users older than the given
--    number of days (their bag rows go with them: cart_items cascades). Not
--    callable by visitors; run it from the SQL editor or a scheduled job.
create function public.delete_stale_anonymous_users(older_than_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  if older_than_days is null or older_than_days < 1 then
    raise exception 'invalid_days' using errcode = '22023';
  end if;
  delete from auth.users
   where is_anonymous
     and created_at < now() - make_interval(days => older_than_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.delete_stale_anonymous_users(integer) from public, anon, authenticated;

commit;
