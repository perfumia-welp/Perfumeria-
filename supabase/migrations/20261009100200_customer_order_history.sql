-- Step 3A · Customer order-request history
--
-- A copy of each order request a signed-in customer prepares at checkout, so
-- it appears under Account → Orders. This is NOT the store's fulfilment
-- system: the store confirms every request by hand, and the only status is
-- 'request_created' until a real store-side status source exists (add new
-- statuses in a later migration, set by the store, never by the customer).
--
-- Items are snapshots (name, size, prices, image at the time), so history
-- stays readable when the catalogue changes. product_ref is the catalogue id
-- at the time and deliberately has no foreign key: products live in the
-- company's Products API, not in Supabase.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null check (char_length(reference) between 1 and 40),
  user_id uuid not null references auth.users (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar')),
  status text not null default 'request_created'
    check (status in ('request_created')),
  customer_name text not null
    check (btrim(customer_name) <> '' and char_length(customer_name) <= 120),
  phone text not null check (btrim(phone) <> '' and char_length(phone) <= 40),
  email text not null check (btrim(email) <> '' and char_length(email) <= 160),
  delivery_address text not null
    check (btrim(delivery_address) <> '' and char_length(delivery_address) <= 300),
  city_area text not null
    check (btrim(city_area) <> '' and char_length(city_area) <= 120),
  notes text check (char_length(notes) <= 1000),
  is_gift boolean not null default false,
  gift_message text check (char_length(gift_message) <= 250),
  promo_code text check (char_length(promo_code) <= 40),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  unique (user_id, reference)
);

comment on table public.orders is
  'Customer order-request history (snapshots). Not the fulfilment system of record.';

create index orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  position smallint not null check (position between 1 and 50),
  product_ref text not null
    check (btrim(product_ref) <> '' and char_length(product_ref) <= 120),
  product_name text not null
    check (btrim(product_name) <> '' and char_length(product_name) <= 120),
  size text check (char_length(size) <= 20),
  quantity integer not null check (quantity between 1 and 99),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  image_url text check (char_length(image_url) <= 500),
  unique (order_id, position)
);

comment on table public.order_items is
  'Product snapshot per order line. product_ref has no FK (catalogue is external).';

create index order_items_order_id_idx on public.order_items (order_id);

-- Row level security: customers can read their own history and nothing else.
-- There are no insert/update/delete policies or grants, so a customer cannot
-- change an order (or its status) after it is created.
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Customers read their own orders"
  on public.orders for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Customers read items of their own orders"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = order_id
         and o.user_id = (select auth.uid())
    )
  );

revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
grant select on table public.orders to authenticated;
grant select on table public.order_items to authenticated;

-- The only way to create history: one call saves the order and all its items
-- in a single transaction (any invalid field rolls everything back). The
-- owner is always the caller (auth.uid()), the status is always
-- 'request_created', and line totals and the subtotal are recalculated here.
-- Calling again with the same reference returns the existing order.
create or replace function public.create_order_request(request jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  new_order_id uuid;
  items jsonb := request -> 'items';
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(items) is distinct from 'array'
     or jsonb_array_length(items) not between 1 and 50 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  select o.id into new_order_id
    from public.orders o
   where o.user_id = caller and o.reference = request ->> 'reference';
  if found then
    return new_order_id;
  end if;

  insert into public.orders (
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
  returning id into new_order_id;

  insert into public.order_items (
    order_id, position, product_ref, product_name, size,
    quantity, unit_price, line_total, image_url
  )
  select
    new_order_id,
    item.ordinality,
    btrim(item.value ->> 'product_ref'),
    btrim(item.value ->> 'product_name'),
    nullif(btrim(item.value ->> 'size'), ''),
    (item.value ->> 'quantity')::integer,
    (item.value ->> 'unit_price')::numeric(12, 2),
    (item.value ->> 'quantity')::integer * (item.value ->> 'unit_price')::numeric(12, 2),
    nullif(btrim(item.value ->> 'image_url'), '')
  from jsonb_array_elements(items) with ordinality as item (value, ordinality);

  return new_order_id;
end;
$$;

revoke execute on function public.create_order_request(jsonb) from public, anon;
grant execute on function public.create_order_request(jsonb) to authenticated;
