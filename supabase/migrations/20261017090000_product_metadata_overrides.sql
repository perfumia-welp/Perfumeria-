-- Perfumeria: curated Arabic name and size for company products.
-- Additive only: two nullable columns on public.product_metadata
-- (live since 20261016090000). No existing column, row, grant, RLS policy,
-- trigger or customer table is changed. The existing grants (SELECT for
-- anon/authenticated, all for service_role) and the public-read policy cover
-- the new columns, so customers still cannot write. The storefront works with
-- or without this migration.
begin;

alter table public.product_metadata
  add column if not exists name_ar text
    constraint product_metadata_name_ar_not_blank
    check (name_ar is null or length(btrim(name_ar)) > 0),
  add column if not exists size_ml integer
    constraint product_metadata_size_ml_range
    check (size_ml is null or size_ml between 1 and 1000);

comment on column public.product_metadata.name_ar is
  'Our Arabic product name. Arabic pages fall back to the company (English) name when null.';
comment on column public.product_metadata.size_ml is
  'Curated bottle size in ml. Overrides the size read from company text; null means none.';

commit;
