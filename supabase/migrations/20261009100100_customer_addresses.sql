-- Step 3A · Saved delivery addresses
--
-- Each customer keeps up to 20 addresses. Exactly one is the default whenever
-- any exist: the first address becomes the default, choosing a new default
-- clears the old one, and deleting the default promotes the newest remaining.

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 40),
  full_name text not null
    check (btrim(full_name) <> '' and char_length(full_name) <= 120),
  phone text not null
    check (btrim(phone) <> '' and char_length(phone) <= 40),
  address text not null
    check (btrim(address) <> '' and char_length(address) <= 300),
  city_area text not null
    check (btrim(city_area) <> '' and char_length(city_area) <= 120),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.addresses is
  'Customer delivery addresses. At most one default per customer.';

create index addresses_user_id_created_at_idx
  on public.addresses (user_id, created_at);

create unique index addresses_one_default_per_user
  on public.addresses (user_id) where is_default;

create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- Runs as the customer (security invoker), so it only ever sees and changes
-- their own rows.
create or replace function public.addresses_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.addresses where user_id = new.user_id) >= 20 then
      raise exception 'address_limit_reached' using errcode = 'P0001';
    end if;
    -- The first address is always the default.
    if not exists (select 1 from public.addresses where user_id = new.user_id) then
      new.is_default := true;
    end if;
  elsif old.is_default and not new.is_default and pg_trigger_depth() = 1 then
    -- The default can only move by choosing another address.
    new.is_default := true;
  end if;

  if new.is_default then
    update public.addresses
       set is_default = false
     where user_id = new.user_id
       and id <> new.id
       and is_default;
  end if;
  return new;
end;
$$;

create trigger addresses_before_write
  before insert or update of is_default on public.addresses
  for each row execute function public.addresses_before_write();

create or replace function public.addresses_after_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_default then
    update public.addresses
       set is_default = true
     where id = (
       select id from public.addresses
        where user_id = old.user_id
        order by created_at desc
        limit 1
     );
  end if;
  return null;
end;
$$;

create trigger addresses_after_delete
  after delete on public.addresses
  for each row execute function public.addresses_after_delete();

revoke execute on function public.addresses_before_write() from public, anon, authenticated;
revoke execute on function public.addresses_after_delete() from public, anon, authenticated;

-- Row level security: customers manage only their own addresses.
alter table public.addresses enable row level security;

create policy "Customers read their own addresses"
  on public.addresses for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Customers add their own addresses"
  on public.addresses for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Customers update their own addresses"
  on public.addresses for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Customers delete their own addresses"
  on public.addresses for delete to authenticated
  using ((select auth.uid()) = user_id);

-- user_id always comes from the session (column default), never the client.
revoke all on table public.addresses from anon, authenticated;
grant select, delete on table public.addresses to authenticated;
grant insert (label, full_name, phone, address, city_area, is_default)
  on table public.addresses to authenticated;
grant update (label, full_name, phone, address, city_area, is_default)
  on table public.addresses to authenticated;
