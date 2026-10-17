# Perfumeria live catalogue (company API + Supabase)

Status 2026-10-17: production-ready, tested against the real API. Production
builds now use the live catalogue; the dev server and `npm run build:mock`
use the mock catalogue. Not deployed.
Nothing was deployed, no Supabase data was written, the wishlist was not
migrated and Welp checkout is not used.

Working assumptions (company confirmation pending): Perfumeria may use the
public API from its domain with `App-ID: WEBSITE` for normal catalogue
traffic; product and option ids are stable; the currency is EGP.

## Sources

| Source | What it provides | Access |
| --- | --- | --- |
| Company API (Welp), business 84116 | Products: id, product type, name, description, prices, image, availability; options on the detail endpoint | Public GET, no token, header `App-ID: WEBSITE`, CORS `*` |
| Supabase `product_metadata` | Our additions: brand, gender override, fragrance family, notes, ingredients, our EN/AR descriptions (and, if approved, Arabic name and curated size) | Public read, write-denied (RLS) |
| Supabase `product_gallery` | Extra images per product, ordered by `sort_order` | Public read, write-denied (RLS) |

Configuration lives in `src/config/catalog.ts`. All of it is public.

**Currency is an assumption.** The API returns no currency. The storefront
uses `LIVE_CATALOG.currency = "EGP"` (company to confirm). Tax is 0 %
(`tax_percentage: 0` on the business record). Mock products keep their USD.

## Direct browser reads, no Edge Function

A real browser on the app origin can GET every endpoint with `App-ID`
(preflight passes, `access-control-allow-origin: *`). The API has no secret
to protect, so `src/services/products/welp.ts` reads it directly: GET only,
fixed paths, `credentials: "omit"`, `redirect: "error"`, 20 s timeout.

`supabase/functions/company-catalog` stays in the repo as a **dormant
fallback**, undeployed and needing no token. Use it later only for a concrete
need: server-side caching, rate limiting, a CORS change on the company side,
or hiding upstream API changes from the storefront.

## Fetching strategy (371 products)

Measured 2026-10-17: `/products?page=1` (20 newest) ~0.4–0.9 s; `/all-products`
(~300 KB, uncompressed) ~3–3.8 s, server-bound; all 19 pages in parallel took
as long as `/all-products`; normalizing 371 products in both languages ~8 ms;
each Supabase read ~0.65–1 s (parallel). `/products` is ordered newest first
(id descending), which the full catalogue reproduces exactly.

- **Progressive load:** the first page, `/all-products` and Supabase start
  together. The site renders on the first page (~1.7 s on a production build,
  was ~4.8 s); the full catalogue follows in the same order, so nothing
  reshuffles. Until then the default Products view shows the newest products
  with the real total, while search, filters, sorting and later pages show a
  quiet skeleton or a loading status. A failed background load shows an error
  with Retry; never mock products.
- **Session cache:** the last full catalogue (with our Supabase rows) is kept
  in sessionStorage for 10 minutes and always refreshed in the background, so
  a reload in the same tab shows products in ~0.1–0.4 s without hiding price
  or availability changes for long.
- **Supabase:** one paged read per table for the business (`select *`, so
  additive columns need no code change). Empty tables are normal.
- **Detail:** `GET /products/{id}` when a product page is opened (options,
  freshest price and availability), once per product per visit. A direct
  product-page visit renders from it (~1.4 s) without waiting for the full
  catalogue. Never fetched for the whole catalogue (no N+1).
- **Not used at runtime:** `/products-types` (two fixed types) and
  `/businesses/84116`.

## Normalization (`src/services/products/adapter.ts`)

Welp field names exist only in the adapter. Components keep consuming the
`Product` type.

- **Identity:** `businessId` 84116 + `productId` (API id); `id` "14092",
  slug `product-14092`. Supabase rows join on both ids.
- **Price:** `price = price_after_discount`; `compareAtPrice =
  price_before_discount` only when valid and higher. A bad "before" value
  never invents a sale; a bad current price excludes the product.
- **Gender:** product type 1344 → men, 1382 → women; `product_metadata.gender`
  overrides; other types stay unknown.
- **Language:** company text is English, even in its `_ar` fields. Arabic
  pages show our Supabase Arabic when present, otherwise the company English,
  marked `contentLocale: "en"` (the product page sets `lang="en"` on it).
  Nothing is auto-translated or invented.
- **Size:** `size_ml` from Supabase if present, else a conservative parse of
  the company text (`src/services/products/size.ts`): digits + "ml", exactly
  one distinct value, not a set or "N x" box. 220 of 371 parse confidently;
  the company text is never changed and parsed sizes are never written to
  Supabase.
- **Options (box / no box):** detail `variations[].options[]` become
  `ProductVariation` with ids, labels and prices. Main-price options replace
  the product price. Arabic labels are kept exactly as written; known labels
  (بالعلبة, بدون علبة, اختر in their spellings) also get English. A multi-select
  choice is rejected (no defined price rule).
- **Not stored:** brand, family and notes come only from Supabase; nothing is
  derived from names or descriptions.
- **Malformed products:** each one is left out and counted (shown on the dev
  badge). An empty catalogue, duplicate ids, a failed API call or a failed
  Supabase read is an error: the gate shows "could not be loaded" and Retry,
  never mock products.

## Presentation of real data

- **Images:** company images are styled square or portrait photographs, not
  cut-outs. Products carry `packshotStyle: "photo"`; cards A/B/C and the
  product page then show the whole photo, contained (never cropped or
  stretched), in one consistent frame on the ivory stage (84% of the stage
  width), without the cut-out floor shadow or reflection. Mock cut-outs are
  unchanged.
- **Card rhythm:** cards fill their grid cell and keep price and Add to Bag on
  the bottom edge, so long names never break a row. Names are not clamped.
- **Empty metadata:** notes lines, index descriptors, Card C's classification
  and its Notes sheet appear only when there is something to show.
- **Filters:** data-driven. Options no product matches are left out, and a
  group with fewer than two options is hidden. Live today: Gender
  (Women/Men) and Price (EGP bands). Family, notes and brand filters appear
  by themselves once Supabase metadata provides them.
- **Pagination:** first, last, current and neighbours with gaps
  (`01 … 07 08 09 … 31` desktop, `01 … 08 … 31` tablet, `Page 8 of 31` between
  arrows on phones); links, `aria-current`, disabled ends, no horizontal scroll.
- **Product page:** company detail on demand; options required when the
  company lists them; long company descriptions set as reading text with
  their line breaks; English copy on Arabic pages marked `lang="en"`; no
  empty sections; breadcrumb by family, else gender.
- **Home:** "Offers for This Season" lists only real company discounts and is
  left out when there are none. The "Private offer" section (a placeholder
  20% code, not a company offer) is never shown with live products.

## "From" prices

A product whose price depends on a required box / no-box choice shows
"From EGP 900" (its lowest main-price option) on cards, search and the product
page until a choice is made; then the exact option price. The company list
price is not shown for these products because it is not reliably either
option. Option prices come with the product detail, fetched only for option
products actually shown (at most one per product per page load). Products
whose options cost the same, or that have no options, show their plain price.
Cart and order lines always carry the chosen option and its exact price.

## Bag, orders, wishlist

- A product with options cannot enter the bag without a pick. A card's
  **Add to Bag** opens its product page; the page offers the choices (existing
  size-row styles) and adds a line with id `productId~optionId`, name
  "Name (With box)" and the option price. With box and without box are
  separate lines. The bag relocalizes the label on a language switch.
- Order requests, WhatsApp, email and order history are unchanged; the line
  snapshot already carries the id, name with option, size, price and image.
- The wishlist is kept per catalogue: the live list (`perfumeria:wishlist:live`)
  accepts only company product ids; the mock list stays under its original key
  (`perfumeria:wishlist`), untouched and never shown with live products. Its
  Supabase migration is deferred.

## Switching

- **Production** (`npm run build`): live. Set in code (`src/services/catalog.ts`),
  not in a `.env.production` file, because `.gitignore` excludes `.env*` files
  and such a file might never reach a build server.
- **Dev server** (`vite`): mock; `?catalog=live` / `?catalog=mock` switches per tab,
  with a red "LIVE CATALOGUE" badge on live pages.
- **Explicit mock build** (`npm run build:mock`, Vite mode "mock"): used by the
  regression audits.
- `VITE_PRODUCT_SOURCE=mock|live`, when set, overrides all of the above.
- No silent fallback: a failed live load shows the error with Retry.

## Supabase schema

Live since 2026-10-16: `20261016090000_product_supplemental.sql`
(`product_metadata`, `product_gallery`, RLS public read, no customer writes).

**Live since 2026-10-17:** `20261017090000_product_metadata_overrides.sql`
(transaction-wrapped, idempotent) adds two nullable columns to
`product_metadata`:

| Column | Why |
| --- | --- |
| `name_ar text` | No Arabic product names exist anywhere else. |
| `size_ml integer` (1–1000) | 151 products have no clear size in the company text. |

`description_ar` is not added: `editorial_description_ar` already holds our
Arabic description. Existing grants and the public-read policy cover the new
columns. The app works with or without this migration.

## Company confirmations needed before production

1. Permission for the Perfumeria domain to use the public API.
2. `App-ID: WEBSITE` officially supported for this use.
3. Rate limits (the storefront makes one catalogue request per visit).
4. Product ids stable over time (wishlist, bags and order history keep them).
5. Option ids stable over time (bag lines and order snapshots keep them).
6. Currency is EGP.
