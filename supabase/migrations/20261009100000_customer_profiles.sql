-- Step 3A · Customer profiles
--
-- One profile per Supabase Auth user. Supabase owns customer data only; the
-- product catalogue stays with the company's Products API.
--
-- Safe to run once on a project that already has users: existing users get a
-- profile from their sign-up metadata (first_name / last_name).

-- Shared trigger: keeps updated_at current on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 80),
  last_name text not null default '' check (char_length(last_name) <= 80),
  phone text not null default '' check (char_length(phone) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Customer profile, one per auth user. Email stays in auth.users.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- New sign-ups get a profile from the names they entered. Runs as the table
-- owner (security definer) because the new user has no session yet.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users who signed up before this migration (e.g. the test account).
insert into public.profiles (id, first_name, last_name)
select
  u.id,
  left(btrim(coalesce(u.raw_user_meta_data ->> 'first_name', '')), 80),
  left(btrim(coalesce(u.raw_user_meta_data ->> 'last_name', '')), 80)
from auth.users u
on conflict (id) do nothing;

-- Row level security: a customer reads and edits only their own profile.
alter table public.profiles enable row level security;

create policy "Customers read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

-- Normally the trigger creates the row; this lets the site repair a missing one.
create policy "Customers create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Customers update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Column privileges: no access for signed-out visitors; customers may change
-- only their names and phone (never id or timestamps). No delete: the profile
-- is removed with the auth user.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant insert (id, first_name, last_name, phone) on table public.profiles to authenticated;
grant update (first_name, last_name, phone) on table public.profiles to authenticated;
