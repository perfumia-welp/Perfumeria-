-- Step 3A follow-up · Resubmitting an edited order request
--
-- Checkout keeps one reference per checkout visit, so "Edit Details" and
-- submitting again sends the same reference. Before this migration the RPC
-- returned the existing order unchanged (the edit was lost from history);
-- now it updates that order's snapshot in place: one history record per
-- reference, showing the latest details the customer sent.
--
-- What a resubmit may change: the customer's details, notes, gift, promo,
-- language and the items (replaced as a whole; totals recalculated here).
-- What it never changes: owner, status, reference or created_at. Updates are
-- only accepted while the order is still 'request_created' and less than 24
-- hours old; after that the RPC raises 'order_locked' and history is left as
-- it was (checkout itself is unaffected: saving history is best-effort).

alter table public.orders
  add column updated_at timestamptz not null default now();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Same signature and grants as before (create or replace keeps them).
create or replace function public.create_order_request(request jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  saved_order_id uuid;
  items jsonb := request -> 'items';
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(items) is distinct from 'array'
     or jsonb_array_length(items) not between 1 and 50 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  -- One statement, so two calls racing on the same reference cannot create
  -- two orders: the second becomes an update of the first.
  insert into public.orders as o (
    reference, user_id, locale, status,
    customer_name, phone, email, delivery_address, city_area, notes,
    is_gift, gift_message, promo_code, subtotal, currency
  )
  values (
    btrim(request ->> 'reference'),
    caller,
    request ->> 'locale',
    'request_created',
    btrim(request ->> 'customer_name'),
    btrim(request ->> 'phone'),
    btrim(request ->> 'email'),
    btrim(request ->> 'delivery_address'),
    btrim(request ->> 'city_area'),
    nullif(btrim(request ->> 'notes'), ''),
    coalesce((request ->> 'is_gift')::boolean, false),
    nullif(btrim(request ->> 'gift_message'), ''),
    nullif(btrim(request ->> 'promo_code'), ''),
    (
      select coalesce(sum((i ->> 'quantity')::integer * (i ->> 'unit_price')::numeric(12, 2)), 0)
        from jsonb_array_elements(items) i
    ),
    request ->> 'currency'
  )
  on conflict (user_id, reference) do update
    set locale = excluded.locale,
        customer_name = excluded.customer_name,
        phone = excluded.phone,
        email = excluded.email,
        delivery_address = excluded.delivery_address,
        city_area = excluded.city_area,
        notes = excluded.notes,
        is_gift = excluded.is_gift,
        gift_message = excluded.gift_message,
        promo_code = excluded.promo_code,
        subtotal = excluded.subtotal,
        currency = excluded.currency
    where o.status = 'request_created'
      and o.created_at > now() - interval '24 hours'
  returning o.id into saved_order_id;

  if saved_order_id is null then
    raise exception 'order_locked' using errcode = '55000';
  end if;

  -- A resubmit replaces the items; a new order has none yet.
  delete from public.order_items oi where oi.order_id = saved_order_id;

  insert into public.order_items (
    order_id, position, product_ref, product_name, size,
    quantity, unit_price, line_total, image_url
  )
  select
    saved_order_id,
    item.ordinality,
    btrim(item.value ->> 'product_ref'),
    btrim(item.value ->> 'product_name'),
    nullif(btrim(item.value ->> 'size'), ''),
    (item.value ->> 'quantity')::integer,
    (item.value ->> 'unit_price')::numeric(12, 2),
    (item.value ->> 'quantity')::integer * (item.value ->> 'unit_price')::numeric(12, 2),
    nullif(btrim(item.value ->> 'image_url'), '')
  from jsonb_array_elements(items) with ordinality as item (value, ordinality);

  return saved_order_id;
end;
$$;

revoke execute on function public.create_order_request(jsonb) from public, anon;
grant execute on function public.create_order_request(jsonb) to authenticated;
