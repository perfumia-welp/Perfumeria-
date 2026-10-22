# Perfumeria frontend audits

Reusable browser regression checks for the Perfumeria frontend. The audit package is intentionally separate from the application package.

## Install

From `scripts/audit/`:

```sh
npm install
```

The scripts use an installed Google Chrome by default. Set `CHROME_PATH` to use another Chrome executable.

## Expected servers

For production-preview checks, build the **mock** catalogue explicitly with `npm run build:mock` (plain `npm run build` now produces the live production catalogue) and run its Vite preview server from the project root. The audits default to `http://localhost:4173`; set `BASE_URL` when the preview uses another origin or deployment sub-path.

`DEV_URL` (a running Vite development server) is optional; no current check needs it.

## Commands

Run these from `scripts/audit/`:

- `npm run routing` — routes, navigation, titles, focus behavior, direct loads, 404 UI, mobile navigation, and focus containment.
- `npm run flows` — cart, catalogue filters/sort/URL state, search, forms, and account states.
- `npm run layout` — responsive overflow/layout checks and automated accessibility checks.
- `npm run consistency` — shared content, product, price, link, and image consistency.
- `npm run carousels` — hero and testimonial controls, timing, reduced motion, and responsive behavior.
- `npm run i18n` — English/Arabic: every `/ar` route at every width (lang/dir, overflow), untranslated text, localized metadata and hreflang, language switching that keeps the query, bag, wishlist, session, scroll and form input, Arabic search, mirrored arrows, RTL carousels and reduced motion.
- `npm run account` — signed-in account in English and Arabic: profile editing, saved-address create/edit/delete/default, order-request history (status wording, items, view all), loading errors with retry, signed-in checkout saving exactly one history record, guest checkout saving nothing, and sign-out.
- `npm run database` — applies `supabase/migrations/` to an in-process Postgres (PGlite, no network) with a small Supabase stand-in, then checks the tables, triggers, row level security and the `create_order_request` function as customers and signed-out visitors.
- `node newsletter-db.mjs` — applies the migrations to PGlite and checks the private newsletter list: visitors can only add an address through `subscribe_newsletter()` (normalized, duplicates answered `already_subscribed`, unsubscribed addresses reactivated) and can never read, count, change or delete subscribers.
- `npm run all` — runs the eight checks above in sequence.
- `npm run visual -- [/route ...]` — compares the current preview with an approved baseline. Set `BASELINE_URL` before running it; routes are optional.

Each command prints pass/fail details and console errors to the terminal and exits non-zero on failure. Visual captures are compared in memory; `scripts/audit/output/` is reserved for audit-generated output and is ignored by Git.

## Live catalogue checks

From the project root, `npm run test:products` runs the adapter, size parser,
repository and (unused) proxy tests with fixtures shaped like the live company
responses. No remote services are contacted. `npm run database` from this
directory also covers the supplemental tables and the proposed override columns
in PGlite.

`node hybrid.mjs` checks an isolated live-mode build at `http://127.0.0.1:8444`
(override with `HYBRID_AUDIT_URL`; 8444 is also another local project's dev
port, so 8450 is a safer choice). Build the production default (live) with
`npx vite build --outDir scripts/audit/output/hybrid-build`, then preview that
directory. Keep the main preview in mock mode. It needs the public Supabase
URL/key so the client can start, but answers every company API and Supabase
request with fixtures and aborts anything else: no live traffic leaves the test
browser. It covers the GET-only contract (App-ID, fixed paths, no N+1), merged
and partial metadata, gallery, EGP prices, box/no-box options as separate bag
lines, card Add to Bag opening the product page, EN/AR fallback,
search/filters, wishlist and catalogue failure/retry.

On the dev server, `?catalog=live` shows the real company catalogue (dev only).

## Signed-in checks

Protected screens (the account page) are rendered with `signInPreview()` from `lib.mjs`: it stores a fake, unexpired Supabase session in the test browser's localStorage and blocks all `/auth/v1/` requests, so nothing reaches Supabase. It proves the signed-in UI only, not real authentication. The storage key is derived from `VITE_SUPABASE_URL` in `.env.local` (or `.env`).

Account data (profile, addresses, orders, the order RPC) is served to these pages by `mockSupabase.mjs`, an in-memory stand-in for the Supabase REST API, so signed-in checks never reach the real project. `signInPreview(page)` starts a seeded account and returns its data for assertions; pass `createAccountData("empty")` for a new account. The real database rules are covered by `npm run database`.

The reviews carousel loops and drifts by design; its control checks run with reduced motion so positions are deterministic, and a separate check confirms the drift.
