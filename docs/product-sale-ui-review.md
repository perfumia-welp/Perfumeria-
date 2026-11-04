# Product sale UI — local review, 2026-11-04

Implementation is for visual review, not a deployment or a new pricing system. The owner has not yet approved the design.

## Scope

Baseline: `main` at `34bd4fb`. No push, deployment, Hostinger/DNS change, production Supabase write, migration edit or Orders modification. `sm.xml` is untouched.

## Presentation

- `ProductCard` and Product Details opt into current-first sale pricing through `ProductPrice`'s `salePresentation` prop. Hero, Search and the alternate review cards do not pass it, so they keep their existing presentation. Cart and Checkout do not use this component path.
- Sale cards show one image badge, the percentage, on the left of the image's top row. There is no SALE label, and the decorative index stays visible.
- English: the badge holds the top-left corner and the index sits beside it, at its usual height.
- Arabic: the heart already holds the top-left corner and must not move, so the badge sits directly beside the heart, on the left half of the card. It is not mirrored to the right. The index keeps its normal place on the right.
- The heart, image and stage keep the same geometry as a normal card, and the row lets clicks through to the image link. The badge stays in the band above the photograph, using tighter vertical padding on phones (1px instead of 4px).
- Badge colours are the existing `--color-text` / `--color-bg` (16.20:1). Original prices use `--color-text-muted-tint` (5.52:1 on the page background).
- The current price comes first with its existing treatment. The original price follows at 85% size, struck through.
- Product Details has a two-level block: the percentage on its own line, then 8px below it the current and original prices. It has no SALE label and no image badge.
- The percentage is an isolated LTR run. Hidden labels name the sale and original prices once, and the percentage badge is hidden from screen readers, so it is never spoken twice.
- No motion, extra catalogue fetch, image-treatment change or control relocation.

## Sale rule and options

`src/lib/productSale.ts` reads the normalized `price` / `compareAtPrice`. Both must be finite, strictly positive numbers, and the current price must be lower than the original. Anything else gets the normal presentation.

The helper computes `round((before - after) / before * 100)` for display only. It never writes or recalculates the selling price. A percentage that rounds to 0 or 100 is omitted, while the valid price pair still appears.

Unselected option products keep the existing "From" behaviour with no guessed original price or percentage. After selection, Product Details uses that option's own pair, and switching to a non-sale option removes the sale presentation immediately.

Read-only API inspection found 395 products, five with a real discount, and 92 option products. All 92 detail responses were read: none exposes a discounted main-price option, and none of the five discounted products is an option product. Discounted-option behaviour is therefore covered by fixtures only. What rule produced the provider's before/after amounts remains unknown pending the Postman audit.

## Live review examples

All five discounted products are 1,500 → 1,100 EGP, shown as −27%:

| Product | ID |
| --- | ---: |
| ASAD ELIXIR EDP | 10849 |
| BOSS THE SCENT ABSOLUTE EDP | 10850 |
| LA'DOR BAKHUR LAVERNE | 10852 |
| MUSAMAM BLACK INTENSE | 11122 |
| ARMANI CODE | 11125 |

Comparison products: Hugo Boss The Scent Absolute, ID 12706 (normal, 1,100 EGP); Afnan 9PM Night Out, ID 13143 (option product, "From 900"). `/products?page=33` shows five sale and six normal cards together while the catalogue stays at this size.

## 320px wrapping

The earlier review attributed a 22px row increase at 320px to a long product name. Measurement shows the cause was the price pair: 125px of text plus a 10px gap in a 134px card, so every English sale card wrapped, and the growth became visible when that card was the tallest in its row. Using the existing 8px spacing token keeps the pair on one line with no font change. Row growth is now 0px at all eight widths in both languages. Longer prices can still wrap, and they wrap without overflow.

## Verification

Run against the final bundle:

| Check | Result |
| --- | --- |
| typecheck, production build, mock build | exit 0 |
| test:auth / test:products / test:server | 5/0, 32/0, 96/0 |
| routing / i18n / layout-a11y | 63/0, 175/0, 23/0 |
| flows / consistency / carousels | 75/0, 35/0, 11/0 |
| account / account-navigation | 89/0, 1 composite/0 |
| database / newsletter-db | 163/0, 50/0 |
| hybrid | 1 composite/0 |
| orders-e2e / reload-seo / guest-bag | 167/0, 366/0, 10/0 |
| sale-ui (8 widths, EN/AR) | 416/0 |
| live-readonly (real catalogue, GET only) | 556/0 |

`hybrid.mjs` asserted the old original-then-current order. It now asserts the requested order, the labels, and that the struck-through value is the original price.

The production smoke check was not repeated, because production did not change.

## Visual comparison

Baseline `34bd4fb` against the final bundle, EN/AR at 1440 and 390 unless noted.

| Area | Result |
| --- | --- |
| Normal card fixture, all 8 widths | 0px in 16/16 |
| Real normal card 12706 | 0px, same height |
| Real listing `/products` (all normal) | 0px, except a 42px Arabic desktop difference that disappeared on repeat |
| `/products?page=33` normal cards, card by card | 0px, except one Arabic mobile card at 3px; all heights unchanged |
| Sale cards | about 2,900–3,300px, intended; heights unchanged |
| Normal PDP 12706 | 0px |
| Option PDP 13143 | 0px, except a 116px English desktop difference that disappeared on repeat |
| Sale PDP | intended price row; 3px page growth at 390, none at 1440 |
| About, Sign-in, Checkout, search overlay | 0px |
| Contact, Account | 0px, except 35px and 20px differences that disappeared on repeat |
| Home | Offers cards change as intended (mock products are all discounted); the rest of the page is 0px outside hero noise of 8–14px, which also appears between captures of one build |
| Cart at 390 | a 1px column flickers between captures; 30 of 36 Arabic cross-build pairs were 0px, and all 51 Cart elements match in DOM, geometry and computed style |

One Arabic Cart capture of the current build differed by 30,671px from every other capture, including the other five of the same build. This points to capture timing. The exact source was not identified.

Logs and screenshots are kept in the ignored `scripts/audit/output/sale-final/`.

## Refinement results

The sections "Verification" and "Visual comparison" above describe `f7fd9f8`. For the later refinement (badge position and two-level Product Details price), the baseline was `f7fd9f8` plus the uncommitted promo-code work, built before the change. Measured at all 8 widths in EN and AR on the real catalogue:

| Check | Result |
| --- | --- |
| Normal cards, first 3 of the listing | 0px on repeat, with 1-10px also present between captures of one build on a few cards |
| Normal PDP 12706, option PDP 13143 | 0px on repeat |
| Sale PDP price block | 27.4px to 57.4px tall, sale products only, 8px between percentage and prices |
| Badge against the 5 real sale photos (1 is slightly portrait) | no overlap, except 0.1px on that one photo at Arabic 320 |
| sale-ui (8 widths, EN/AR) | 648/0 |

A photo noticeably taller than the 5 current ones would touch the badge's lower edge at the narrowest cards. `sale-ui.mjs` measures against a square photo, because all current catalogue photos are square or nearly so.

## Local review

`npm run dev` on port 8443 with `VITE_PRODUCT_SOURCE=live` set for that process only. The dev server uses the real Supabase project, so Add to Bag there can create a real guest cart row.
