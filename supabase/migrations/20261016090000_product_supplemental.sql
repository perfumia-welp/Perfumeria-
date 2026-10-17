begin;

-- External products deliberately have no local product/auth/order foreign key.
create table public.product_metadata (
  business_id bigint not null check (business_id > 0),
  product_id bigint not null check (product_id > 0),
  brand text,
  gender text check (gender in ('women', 'men', 'unisex')),
  fragrance_family text,
  top_notes text[] not null default '{}',
  heart_notes text[] not null default '{}',
  base_notes text[] not null default '{}',
  ingredients text,
  editorial_description_en text,
  editorial_description_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, product_id)
);

create table public.product_gallery (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null check (business_id > 0),
  product_id bigint not null check (product_id > 0),
  image_url text not null check (image_url ~ '^https?://[^[:space:]]+$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  alt_en text,
  alt_ar text,
  created_at timestamptz not null default now(),
  unique (business_id, product_id, image_url)
);
-- Gallery is independent of metadata: a product can have images alone.
create index product_gallery_order_idx on public.product_gallery (business_id, product_id, sort_order, id);

create function public.touch_product_metadata_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger product_metadata_updated_at before update on public.product_metadata
for each row execute function public.touch_product_metadata_updated_at();
revoke all on function public.touch_product_metadata_updated_at()
from public, anon, authenticated;

alter table public.product_metadata enable row level security;
alter table public.product_gallery enable row level security;
revoke all on public.product_metadata, public.product_gallery from anon, authenticated;
grant select on public.product_metadata, public.product_gallery to anon, authenticated;
grant all on public.product_metadata, public.product_gallery to service_role;
create policy product_metadata_public_read on public.product_metadata
for select to anon, authenticated using (true);
create policy product_gallery_public_read on public.product_gallery
for select to anon, authenticated using (true);
-- No customer write policies. No changes to existing tables or policies.

commit;
