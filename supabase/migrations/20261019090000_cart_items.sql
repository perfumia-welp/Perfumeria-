-- Shopping bag for signed-in customers
--
-- One row per bag line: the company product (Welp business + product id) and
-- the company option ids picked for it (with box / without box), in the
-- product's variation order, plus a quantity. Nothing about the product is
-- stored: name, image, price, stock and option labels always come from the
-- live company catalogue, so a stored row can never set a price.
--
-- Identity: the same product with the same options is one line (adding it
-- again raises the quantity, see add_cart_item); the same product with
-- different options is a separate line. product_id has no foreign key: the
-- catalogue lives in the company's Products API, not in Supabase.

begin;

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  business_id bigint not null check (business_id > 0),
  product_id bigint not null check (product_id > 0),
  option_ids bigint[] not null default '{}'
    check (
      cardinality(option_ids) <= 10
      and array_position(option_ids, null) is null
      and 0 < all (option_ids)
    ),
  quantity integer not null check (quantity between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, business_id, product_id, option_ids)
);

comment on table public.cart_items is
  'Signed-in customers'' bag lines: company product + option ids and quantity only. Product data comes from the live catalogue.';

create index cart_items_user_id_created_at_idx
  on public.cart_items (user_id, created_at);

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- At most 50 lines per customer (an order request takes at most 50 items).
-- A line already in the bag passes, so add_cart_item can still raise its
-- quantity (the trigger fires before ON CONFLICT turns the insert into an
-- update). Runs as the customer (security invoker): it only sees their rows.
create function public.cart_items_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
       select 1 from public.cart_items
        where user_id = new.user_id
          and business_id = new.business_id
          and product_id = new.product_id
          and option_ids = new.option_ids
     )
     and (select count(*) from public.cart_items where user_id = new.user_id) >= 50 then
    raise exception 'cart_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger cart_items_before_insert
  before insert on public.cart_items
  for each row execute function public.cart_items_before_insert();

revoke execute on function public.cart_items_before_insert() from public, anon, authenticated;

-- Row level security: customers read and change only their own bag.
alter table public.cart_items enable row level security;

create policy "Customers read their own bag"
  on public.cart_items for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Customers add to their own bag"
  on public.cart_items for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Customers update their own bag"
  on public.cart_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Customers delete from their own bag"
  on public.cart_items for delete to authenticated
  using ((select auth.uid()) = user_id);

-- user_id always comes from the session (column default), never the client;
-- only the quantity of an existing line can change. Visitors without a
-- session (anon) have no access at all.
revoke all on table public.cart_items from anon, authenticated;
grant select, delete on table public.cart_items to authenticated;
grant insert (business_id, product_id, option_ids, quantity)
  on table public.cart_items to authenticated;
grant update (quantity) on table public.cart_items to authenticated;

-- Add to Bag: one statement inserts the line or, when the customer already
-- has the same product with the same options, raises its quantity (capped at
-- 10). Runs as the customer (security invoker): row level security and the
-- grants above apply exactly as for a direct insert or update.
create function public.add_cart_item(
  p_business_id bigint,
  p_product_id bigint,
  p_option_ids bigint[],
  p_quantity integer
)
returns setof public.cart_items
language sql
security invoker
set search_path = ''
as $$
  insert into public.cart_items as c (business_id, product_id, option_ids, quantity)
  values (p_business_id, p_product_id, coalesce(p_option_ids, '{}'), least(p_quantity, 10))
  on conflict (user_id, business_id, product_id, option_ids)
  do update set quantity = least(10, c.quantity + excluded.quantity)
  returning c.*;
$$;

revoke execute on function public.add_cart_item(bigint, bigint, bigint[], integer) from public, anon;
grant execute on function public.add_cart_item(bigint, bigint, bigint[], integer) to authenticated;

commit;
