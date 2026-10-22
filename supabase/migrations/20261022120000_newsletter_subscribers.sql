-- Newsletter subscribers (footer sign-up)
--
-- A private list: website visitors can add an address through
-- subscribe_newsletter() and nothing else. They cannot read, list, change or
-- delete rows, and the function returns only "subscribed" or
-- "already_subscribed", never a row. The store reads the list from the
-- Supabase dashboard (service role).
--
-- Stored per address: the address as typed, its normalized form (trimmed,
-- lower case; one row per normalized address), the site language, where it
-- was collected and its status. No IP address, user agent or account link is
-- kept. Nothing is emailed when someone subscribes.

begin;

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254),
  email_normalized text not null unique
    check (email_normalized = lower(btrim(email_normalized))),
  locale text not null default 'en' check (locale in ('en', 'ar')),
  source text not null default 'footer' check (source in ('footer')),
  status text not null default 'active'
    check (status in ('active', 'unsubscribed')),
  subscribed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  check ((status = 'unsubscribed') = (unsubscribed_at is not null))
);

comment on table public.newsletter_subscribers is
  'Private newsletter list from the website footer. Written only through subscribe_newsletter(); no client can read it.';

create trigger newsletter_subscribers_set_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

-- Row level security with no policies, and no table privileges for website
-- roles: anon and authenticated (signed-in and anonymous guests alike) can
-- neither read nor write the table directly.
alter table public.newsletter_subscribers enable row level security;
revoke all on table public.newsletter_subscribers from public, anon, authenticated;

-- Sign-up: validates and normalizes the address, then adds it or, for an
-- address that unsubscribed, reactivates it. A second sign-up of an active
-- address changes nothing and reports "already_subscribed". Runs as the
-- table owner (security definer) because callers have no table access; the
-- search path is empty so every name is schema-qualified.
create function public.subscribe_newsletter(
  p_email text,
  p_locale text default 'en',
  p_source text default 'footer'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := btrim(coalesce(p_email, ''));
  v_normalized text := lower(btrim(coalesce(p_email, '')));
  v_locale text := coalesce(p_locale, 'en');
  v_source text := coalesce(p_source, 'footer');
begin
  -- Same rule as the website and server (src/lib/validation.ts).
  if char_length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if v_locale not in ('en', 'ar') then
    raise exception 'invalid_locale' using errcode = '22023';
  end if;
  if v_source not in ('footer') then
    raise exception 'invalid_source' using errcode = '22023';
  end if;

  insert into public.newsletter_subscribers (email, email_normalized, locale, source)
  values (v_email, v_normalized, v_locale, v_source)
  on conflict (email_normalized) do nothing;
  if found then
    return 'subscribed';
  end if;

  update public.newsletter_subscribers
     set status = 'active',
         unsubscribed_at = null,
         subscribed_at = now(),
         email = v_email,
         locale = v_locale,
         source = v_source
   where email_normalized = v_normalized
     and status = 'unsubscribed';
  if found then
    return 'subscribed';
  end if;

  return 'already_subscribed';
end;
$$;

revoke execute on function public.subscribe_newsletter(text, text, text) from public;
grant execute on function public.subscribe_newsletter(text, text, text) to anon, authenticated;

commit;
