-- Verified orders (Node /api/orders)
--
-- The production server checks every order against the company catalogue
-- (server/orders.mjs) and stores the result through store_verified_order(),
-- callable by the service role only. The browser's prices are never stored.
--
-- Additive only: safe to apply while the current checkout is live, and it
-- must be applied BEFORE the Node release that calls it. Signed-in customers
-- keep their grant on create_order_request() so the checkout already in
-- production keeps saving history until the release is deployed;
-- 20261023090000_lock_order_requests.sql then removes that grant.
--
-- Company notification email: one sender at a time owns a claim
-- (notification_claim + notification_claimed_at). A claim older than five
-- minutes belongs to a sender that died and may be taken over, so a crash
-- never locks an order. An edited resubmit (same reference, different
-- content) raises the revision and queues a new, "updated" notification.

begin;

alter table public.orders
  add column verified_snapshot jsonb,
  add column request_fingerprint text,
  add column revision integer not null default 1 check (revision >= 1),
  add column notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sending', 'sent', 'failed')),
  add column notification_claim uuid,
  add column notification_claimed_at timestamptz,
  add constraint orders_notification_claim_matches_status check (
    (notification_status = 'sending')
      = (notification_claim is not null and notification_claimed_at is not null)
  );

-- Arabic display name of each item when the catalogue has an approved one
-- (product_metadata.name_ar); product_name stays the company's English.
alter table public.order_items
  add column product_name_ar text
    check (product_name_ar is null
      or (btrim(product_name_ar) <> '' and char_length(product_name_ar) <= 120));

create function public.store_verified_order(request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (request ->> 'owner')::uuid;
  fingerprint text := request ->> 'fingerprint';
  snapshot jsonb := request -> 'snapshot';
  existing public.orders;
  saved_id uuid;
  saved public.orders;
  next_revision integer;
begin
  if owner_id is null or snapshot is null or coalesce(length(fingerprint), 0) <> 64 then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(owner_id::text || (snapshot ->> 'reference'), 0));
  select * into existing from public.orders
   where user_id = owner_id and reference = snapshot ->> 'reference';

  -- The same order again (a retry, a double click): returned unchanged.
  if existing.id is not null and existing.request_fingerprint = fingerprint then
    return to_jsonb(existing);
  end if;
  -- An edit waits while the previous version's email is being sent, unless
  -- that sender's claim is older than five minutes (abandoned).
  if existing.notification_status = 'sending'
     and existing.notification_claimed_at > pg_catalog.now() - interval '5 minutes' then
    raise exception 'order_locked' using errcode = '55000';
  end if;

  -- create_order_request keeps the transaction, the one-record-per-reference
  -- rule and the 24-hour edit lock. It reads the owner from the JWT subject;
  -- Node set that owner only after verifying the session (auth.getUser).
  perform pg_catalog.set_config('request.jwt.claim.sub', owner_id::text, true);
  saved_id := public.create_order_request(jsonb_build_object(
    'reference', snapshot ->> 'reference', 'locale', snapshot ->> 'locale',
    'customer_name', snapshot #>> '{customer,fullName}', 'phone', snapshot #>> '{customer,phone}',
    'email', snapshot #>> '{customer,email}', 'delivery_address', snapshot #>> '{delivery,address}',
    'city_area', snapshot #>> '{delivery,cityArea}', 'notes', snapshot ->> 'notes',
    'is_gift', snapshot -> 'gift' <> 'null'::jsonb, 'gift_message', snapshot #>> '{gift,message}',
    'promo_code', snapshot #>> '{promo,code}', 'currency', snapshot ->> 'currency',
    'items', (select jsonb_agg(jsonb_build_object(
      'product_ref', i ->> 'productId', 'product_name', left(i ->> 'name', 120),
      'size', i ->> 'size', 'quantity', i -> 'quantity', 'unit_price', i -> 'unitPrice', 'image_url', i ->> 'imageUrl'
    ) order by n) from jsonb_array_elements(snapshot -> 'lines') with ordinality as l (i, n))
  ));

  -- Items are numbered from 1 in line order.
  update public.order_items oi
     set product_name_ar = nullif(left(btrim(l.line ->> 'nameAr'), 120), '')
    from jsonb_array_elements(snapshot -> 'lines') with ordinality as l (line, n)
   where oi.order_id = saved_id and oi.position = l.n;

  next_revision := case when existing.id is null then 1 else existing.revision + 1 end;
  select * into saved from public.orders where id = saved_id;
  snapshot := jsonb_set(snapshot, '{createdAt}', to_jsonb(saved.created_at));
  snapshot := jsonb_set(snapshot, '{revision}', to_jsonb(next_revision));
  update public.orders
     set verified_snapshot = snapshot, request_fingerprint = fingerprint,
         revision = next_revision, notification_status = 'pending',
         notification_claim = null, notification_claimed_at = null
   where id = saved_id
  returning * into saved;
  return to_jsonb(saved);
end;
$$;

-- Takes the right to send an order's notification. Returns the claim, or
-- null when it is already sent or another sender holds a fresh claim. Two
-- callers racing on one row cannot both win: the second re-checks the row
-- after the first commits and finds a fresh claim.
create function public.claim_order_notification(order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim uuid;
begin
  update public.orders o
     set notification_status = 'sending',
         notification_claim = pg_catalog.gen_random_uuid(),
         notification_claimed_at = pg_catalog.now()
   where o.id = order_id
     and (o.notification_status in ('pending', 'failed')
       or (o.notification_status = 'sending'
         and o.notification_claimed_at <= pg_catalog.now() - interval '5 minutes'))
  returning o.notification_claim into claim;
  return claim;
end;
$$;

-- Records the outcome for the sender that still owns the claim. False when
-- the claim was taken over meanwhile (that sender records its own outcome).
create function public.finish_order_notification(order_id uuid, claim uuid, outcome text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if outcome is null or outcome not in ('sent', 'failed') then
    raise exception 'invalid_outcome' using errcode = '22023';
  end if;
  update public.orders o
     set notification_status = outcome,
         notification_claim = null,
         notification_claimed_at = null
   where o.id = order_id
     and o.notification_status = 'sending'
     and o.notification_claim = claim;
  return found;
end;
$$;

revoke all on function public.store_verified_order(jsonb) from public, anon, authenticated;
revoke all on function public.claim_order_notification(uuid) from public, anon, authenticated;
revoke all on function public.finish_order_notification(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.store_verified_order(jsonb) to service_role;
grant execute on function public.claim_order_notification(uuid) to service_role;
grant execute on function public.finish_order_notification(uuid, uuid, text) to service_role;

-- Guest orders belong to the guest's anonymous identity: company records,
-- not account history (the restrictive policies still hide them from the
-- guest). Abandoned anonymous identities with orders are kept.
create or replace function public.delete_stale_anonymous_users(older_than_days integer default 30)
returns integer language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  if older_than_days is null or older_than_days < 1 then
    raise exception 'invalid_days' using errcode = '22023';
  end if;
  delete from auth.users u where u.is_anonymous
    and u.created_at < now() - make_interval(days => older_than_days)
    and not exists (select 1 from public.orders o where o.user_id = u.id);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

commit;
