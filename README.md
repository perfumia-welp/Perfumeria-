# Perfumira

Bilingual (English / Arabic) luxury perfume storefront. React 19 + Vite 8 single-page app, with Supabase for customer accounts and the company's Welp catalogue for products.

## Requirements

- Node.js 22.12 or newer (`engines` in `package.json`; `.mise.toml` pins Node 22)
- npm (the deployment lockfile is `package-lock.json`)

## Build (Hostinger Node.js Web App)

| Setting | Value |
| --- | --- |
| Node.js version | 22.x |
| Install command | `npm ci` (installs dev dependencies too: Vite is needed to build) |
| Build command | `npm run build` |
| Start command | `npm start` (= `node server.mjs`; entry file `server.mjs`) |
| App base path | `/` (serve from the domain root) |

`server.mjs` (Express) serves the Vite build in `dist/`, answers every app route with `index.html` (see Deep links), and handles the form API:

- `POST /api/contact` — contact form (including `?topic=wholesale` and `?topic=track-order`), emailed to the store through Titan SMTP. Validated server-side, honeypot field, rate limited per visitor in memory (8 per 15 minutes), 32 KB body limit.
- `GET /api/health` — returns `{ "ok": true }`.

Server tests (no email is sent; the mail transport is faked): `npm run test:server`.

### Environment variables (server only, read at runtime)

Set these in Hostinger's environment variables for the web app. They are never in the browser bundle and must never get a `VITE_` prefix. Without `SMTP_PASS` the site runs and the contact form says sending is unavailable.

| Variable | Value |
| --- | --- |
| `SMTP_HOST` | `smtp.titan.email` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `info@perfumira.net` |
| `SMTP_PASS` | the mailbox password (secret, Hostinger only) |
| `MAIL_FROM` | `Perfumira Website <info@perfumira.net>` |
| `MAIL_TO` | `info@perfumira.net` |
| `TRUST_PROXY` | Optional. Proxies in front of the app (default `1`), so the rate limit sees each visitor's address. |

The visitor's address is only the Reply-To; mail is always sent from `MAIL_FROM` to `MAIL_TO`.

`npm run build` always builds the **LIVE** company catalogue. It never falls back to mock products: if the catalogue cannot load, the page shows an error with Retry.

### Environment variables (public, needed at build time)

Vite writes these values into the browser bundle when it builds, so set them in Hostinger **before** the build runs. Both are public browser values. Never use a Supabase secret or service_role key here.

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (`https://<project-ref>.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (`sb_publishable_…`) |
| `VITE_SITE_URL` | `https://perfumira.net` (production domain for canonical and sitemap URLs). |
| `VITE_PRODUCT_SOURCE` | Optional. Leave unset for production (= `live`). |

Copy `.env.example` to `.env.local` for local work. `.env.local` is git-ignored and must stay that way. If the Supabase values are missing, the site still builds, but sign-in, accounts and order history show "not available".

### Deep links (SPA fallback)

Every route is client-side: `/products`, `/products/product-13143`, `/about`, `/contact`, `/sign-in`, `/account`, `/ar/products`, `/ar/products/product-13143`, and so on. The server must answer unknown paths with `index.html`.

`server.mjs` does this on the Node.js web app, with the same rules as below. `public/.htaccess` (copied to `dist/.htaccess` by the build) does it for static Apache/LiteSpeed hosting:

- real files are served as-is
- a missing `/assets/…` file returns a true 404
- every other path returns `index.html`
- `index.html` is always revalidated

Hosts that ignore `.htaccess` need an equivalent "rewrite to /index.html" rule.

### Search engines (SEO)

- **Site address:** canonical, hreflang, Open Graph and sitemap URLs use the production domain `https://perfumira.net` (`src/config/site.ts`). Set `VITE_SITE_URL=https://perfumira.net` in Hostinger before the build; it overrides the default. Never point it at localhost or a tunnel.
- **Sitemap:** `npm run build` first runs `scripts/seo/generate-sitemap.mjs` (the `prebuild` script). It reads the live catalogue and writes `public/sitemap.xml` and the `Sitemap:` line of `public/robots.txt`. If the catalogue cannot be read, the existing sitemap is kept and the build continues. Run it on its own with `npm run seo:sitemap`. Arabic product URLs are listed only once a product has our own Arabic name in Supabase `product_metadata`.
- **robots.txt:** `public/robots.txt` allows everything and points to the sitemap. Private pages (bag, checkout, account, sign-in, password pages, wishlist) and search results are kept out of results by a `noindex` robots meta tag on the page itself, not by robots.txt.
- **Indexing switch:** `.figma/make/site.json` → `robots.index` must stay `true` for the production site. `false` adds `noindex, nofollow` to every page and a `Disallow: /` robots.txt. Use it only for a private staging host.
- **Rendering:** titles, canonicals, hreflang and JSON-LD are written by the app in the browser (`src/components/layout/SiteLayout.tsx`, `src/lib/seo.ts`). Google renders JavaScript; crawlers that do not see only the static defaults in `index.html`.

## Development

```bash
npm ci
npm run dev           # http://localhost:8443
npm run typecheck
npm run test:products # catalogue adapter / repository unit tests
npm run build:mock    # production build against the mock catalogue (audits)
```

- **Catalogue source:** the dev server uses the **mock** catalogue by default. `?catalog=live` / `?catalog=mock` switches it for the browser tab, and a small dev-only badge shows which one is active. The badge and switch are absent from production builds.
- **Review tunnel:** on the dev server only, the review tunnel host listed in `src/services/catalog.ts` (`LIVE_REVIEW_HOSTS`) defaults to live; `vite.config.ts` allows that host.
- **Browser audits** (Playwright, PGlite migration tests) live in `scripts/audit/` with their own `package.json`. See `scripts/audit/README.md`.
- **Formatting:** only format named files (`npx oxfmt src/path/File.tsx`). Never run the formatter without paths.

## Product catalogue (Welp)

- Requests are direct, public `GET` calls from the browser to `https://api.welpstar.com/api/v1/businesses/84116/…`. No token, no secret, no server proxy.
- Every request sends the header `App-ID: WEBSITE` (configured in `src/config/catalog.ts`).
- Product images load from the company's object storage host.
- The Supabase Edge Function `supabase/functions/company-catalog` is a dormant fallback and is not deployed.

### Pending company confirmation

These are implemented as working assumptions and still need formal confirmation from the company:

- `App-ID: WEBSITE` as the official website application id
- currency is EGP (the API sends no currency)
- product type 1344 = men, 1382 = women
- price filter bands and box / no-box option handling
- product naming and casing, which are kept exactly as provided

## Supabase

Project: the Perfumeria Supabase project (its URL is given by `VITE_SUPABASE_URL`).

- **Auth:** email sign-up with confirmation, sign-in, password reset.
- **Customer data:** profiles, addresses and order history, plus supplemental product metadata (Arabic names, sizes).
- **Migrations:** `supabase/migrations/` (all applied to the live project). Local tests: `node scripts/audit/database.mjs`.
- **Production domain setup:** in Authentication → URL Configuration, set the Site URL and add `https://<domain>/**` to Redirect URLs. Confirmation and reset emails then return to the live site in both languages.
- `supabase/functions/send-order-request` is not deployed.

## Project layout

- `src/` app source (`config/`, `services/`, `i18n/en|ar`, `pages/`, `components/`)
- `public/` static files copied into `dist/` (images, videos, `.htaccess`)
- `supabase/` migrations and (undeployed) Edge Functions
- `scripts/audit/` regression audits and tests
- `docs/`, `FRONTEND_HANDOFF.md` architecture and handoff notes
