# Perfumeria frontend handoff

The approved frontend is complete and ready for backend integration. Preserve the existing layouts, interaction patterns, URL behavior, accessibility behavior, and component contracts while replacing mock adapters and content.

## Implemented routes

- `/` — homepage
- `/products` — catalogue
- `/products/:slug` — product detail page (unknown slugs show the 404 page)
- `/wishlist` — saved fragrances (works signed out)
- `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` — Supabase Auth
- `/checkout` — order request (redirects to the bag when it is empty)
- `/about`
- `/contact`
- `/account` — protected; signed-out visitors go to `/sign-in`
- `/cart` — shopping bag
- `*` — client-side 404 fallback

Every route also exists in Arabic under `/ar` (`/ar`, `/ar/products`, `/ar/products/:slug`, … `/ar/reset-password`); slugs and query values are the same in both languages. Search is a site-wide overlay, not a route.

## Languages (English + Arabic)

- **URL is the source of truth.** English has no prefix; Arabic is `/ar/…`. One route tree serves both (`:lang?` in `src/router/router.tsx`), so pages are not duplicated and stay mounted when the language changes. Any other prefix (`/fr/…`, `/en/…`) is a 404.
- **Switcher:** `EN | AR` links before Search on desktop and in the mobile menu (`src/components/layout/LanguageSwitch.tsx`). They keep the path, query and hash; the bag, wishlist, gift message, promo, session, form input and scroll position survive. The last choice is saved in `localStorage` (`perfumeria:locale`) but never overrides an opened URL.
- **Messages:** `src/i18n/en/*` (reference shape) and `src/i18n/ar/*` (typed `Messages`; a missing key fails the build), one file per namespace. Components read `t` from `useI18n()`; links written as English paths are localised by `AppLink` (code that navigates uses `localize()`). Arabic is a separate chunk loaded by the root route loader before an `/ar` page renders.
- **Text that outlives a switch** (form errors, statuses, announcements) is stored as a key or `(t) => string` and translated when shown.
- **RTL:** `<html lang dir>` is set by `LocaleProvider` (and by an inline script in `index.html` for a first load under `/ar`). Component CSS uses logical properties; `src/styles/rtl.css` holds the direction variables, arrow mirroring and Arabic typography (Noto Naskh Arabic for display, IBM Plex Sans Arabic for text, loaded only for Arabic; Latin text keeps Instrument Serif / Inter). Photographs, packshots, video, the wordmark and decorative image overlays are not mirrored.
- **Numbers:** `Intl.NumberFormat` (`ar-u-nu-latn`: Latin digits, Gregorian dates). Prices never change with language.
- **Metadata:** localised title, description, `og:title/description`, `og:locale`, and `hreflang` en / ar / x-default built from the current origin (no domain hard-coded), like the canonical. `noindex` is unchanged.
- **Order message** (email draft now, WhatsApp once a number is set) is written in the checkout language (`checkout.orderMessage` in each locale; `OrderRequest.locale` records it). Arabic lines start right to left and phone, email, reference, code and prices are isolated left to right. The server email from the Edge Function (store inbox, not deployed) is unchanged.
- **Supabase emails** return to the visitor’s language: sign-up confirmation → `/account` or `/ar/account`, password reset → `/reset-password` or `/ar/reset-password` (`emailRedirectTo` / `redirectTo` in `AuthProvider`). Supabase accepts any path on the Site URL’s host; keep `http://localhost:8443/**` and `https://<production host><base>/**` in Authentication → Redirect URLs so this keeps working when the Site URL changes.
- **Hero A/B comparison** is development-only: on the Vite dev server open `/?compare-hero`. Production builds do not include it.

## Implemented frontend features

- Responsive homepage, catalogue, About, Contact, Account, Cart, and 404 experiences.
- Catalogue filtering, sorting, pagination-ready results, search, and URL-driven state.
- Search overlay with results and keyboard/focus handling.
- Account dashboard UI with orders, wishlist, addresses, details, and empty-state previews.
- Session cart with quantities, limits, totals, removal, undo, empty state, and unavailable checkout/promotion messaging.
- Contact and newsletter validation with honest unavailable-service states.
- Desktop/mobile navigation, mobile filters, responsive layouts, and sticky mobile checkout behavior.
- Accessible focus management, semantic controls, reduced-motion support, and responsive modal sheets.
- Hero and testimonial carousels.

## Temporary and mock functionality

- Products and catalogue data are mocked locally. Product-page copy (description, top/heart/base notes, character words) is TEMPORARY content in `src/data/productStories.ts` (English) and `src/data/productStories.ar.ts` (Arabic); Arabic note names for cards and search are in `src/i18n/ar/catalog.ts`.
- Product pages offer one size per product because the catalogue has one; a real size/variant selector needs variant data from the product API.
- Account name and email are real (Supabase Auth). Orders and addresses are mock data, labelled "Preview".
- The wishlist is real but stored in this browser's localStorage (`perfumeria:wishlist`), behind the adapter in `src/services/wishlist.ts`.
- Cart state lasts only for the current React session and is not server-priced or persisted.
- Gift messages are not persisted.
- Contact details and several site/footer links are placeholders.
- Editorial photography currently uses temporary Unsplash assets.
- Product packshots include temporary third-party branded bottle imagery.
- Authentication, account mutations, checkout, promotions, contact delivery, and newsletter subscription are unavailable until their APIs are connected.

## Backend integration map

| Area | Replace or connect | Integration note |
| --- | --- | --- |
| Catalogue | `src/data/catalog.ts`, `src/services/catalog.ts` | Keep the existing query/result types and URL-driven `ProductQuery` behavior where practical; move filtering, sorting, and paging server-side as needed. Every service function takes the locale: commercial fields are shared, descriptive fields (notes, stories, alt text, facet labels) come in that language — request them localised from the API (e.g. `Accept-Language`) and map to the same `Product`. |
| Homepage / CMS | `src/data/home.ts`, `src/data/about.ts`, `src/i18n/*/home.ts`, `src/i18n/*/about.ts` | Media and links are in `data/`; words per language in `i18n/`. Replace both with CMS content per locale. |
| Cart | `src/cart/BagProvider.tsx` | Replace session state with the cart API. Preserve the existing `useBag()` interface from `src/cart/bagContext.ts` if practical to minimize UI changes. |
| Checkout | `src/services/checkout.ts` | Connect promotion and checkout-session endpoints; pricing, shipping, and tax must come from the backend. |
| Account / auth | `src/services/account.ts`, `src/data/account.ts` | Identity is Supabase Auth (`src/auth`). Replace the mock orders/addresses, then implement the declared account actions. |
| Wishlist | `src/services/wishlist.ts` | Replace `loadWishlist` / `saveWishlist` / `subscribeToWishlist` with the account API (keeping their signatures); `WishlistProvider` and components stay unchanged. Decide how a signed-out device wishlist merges on sign-in. |
| Product pages | `src/data/productStories.ts`, `src/data/productStories.ar.ts`, `src/types/catalog.ts` | Map API descriptions and note pyramids (per language) to `ProductStory`; `slug` must be unique, URL-safe and the same in both languages. |
| Contact | `src/services/contact.ts` | Connect the message endpoint and map backend success/error outcomes. |
| Newsletter | `src/services/newsletter.ts` | Connect subscription and preserve the existing result states. |
| Site / contact links | `src/data/contact.ts`, `src/data/site.ts` | Replace company details and enable confirmed customer-care, legal, and social destinations. |

Shared catalogue, commerce, and content contracts live in `src/types/`.

## Required production assets and details

- Final hero images, product photography, and category imagery.
- Approved product packshots.
- Final About-page photography.
- Approved review avatars, if reviews continue to use portraits.
- Favicon and social-sharing image.
- Confirmed company name, support email, phone, service hours, social profiles, legal links, and customer-care links.

Existing third-party branded bottle imagery is placeholder-only and must not ship as final production imagery.

## Deployment requirements

- Configure an SPA fallback/rewrite to `index.html`.
- Verify direct refreshes for `/products`, `/about`, `/contact`, `/account`, `/cart` and their `/ar/…` versions on the production host.
- The current deployment emits `noindex, nofollow`/disallow rules (`robots.index: false` in `.figma/make/site.json`). This is intentional until launch; set `index` to true (or remove it) as a required launch change.
- `og:image` (`index.html`) is the relative path `/social-preview.png`; most social scrapers need an absolute URL, so make it absolute once the production domain is known. The favicon (`public/favicon.svg`) and social image (`public/social-preview.png`) are placeholders.
- Canonical URLs are set at runtime from the current origin (`src/lib/documentMeta.ts`), so no domain is hard-coded; query strings are excluded and 404s have none. Crawlers that do not run JavaScript see only the defaults in `index.html`.
- A true HTTP 404 response for unknown routes may require host or server configuration. Do not change the routing architecture solely to address an unconfirmed hosting limitation.

## Known technical debt

- `oxfmt` 0.2.0 has a formatting limitation around one-line object types; keep compatible formatting until the formatter is deliberately upgraded.
- The app currently uses React Router v7 APIs. Confirm the long-term compatibility/support decision during the next dependency review.
- Tailwind CSS is installed and wired through Vite but the approved UI relies almost entirely on component CSS.
- Every page except Home and 404 is a lazily loaded route chunk; Supabase loads on demand (still started at app start). Other page chunks are prefetched when the browser is idle.
- **Never run `pnpm format` / `oxfmt` without file paths.** With no paths, oxfmt 0.2.0 formats `node_modules` too, and because pnpm hardlinks packages it rewrites the shared pnpm store. Format named files only (`npx oxfmt src/...`), or check with `npx oxfmt --check src`.

## Pre-launch checklist

- Connect catalogue, cart, checkout, authentication/account, search, contact, and newsletter APIs.
- Replace mock content, placeholder links, and company/contact details.
- Replace all temporary and third-party imagery with licensed production assets.
- Verify the production SPA fallback and direct-refresh routes.
- Remove `noindex` and disallow rules (`robots.index` in `.figma/make/site.json`).
- Make `og:image` absolute and replace the placeholder favicon and social image.
- Enter the confirmed WhatsApp number in `src/config/company.ts` and, once the Edge Function is deployed with its secrets, set `orderEmailEnabled`. Until then checkout offers a prefilled email to the order inbox from the customer's own mail app.
- Configure true server-side 404 handling if the host/product requirements call for it.
- Test production checkout, authentication, search, contact, and newsletter flows end to end.
- Run a final accessibility regression.
- Complete final cross-browser and physical-device testing.
