// Buy 3 — Cheapest Item Free: live prices -> bag -> checkout -> /api/orders ->
// stored order -> company email -> order history.
// Isolated like minimum-order-e2e.mjs: browser -> Express -> verifier -> real
// SQL migrations (PGlite) with a fake mail transport. Network: read-only GETs
// of live Welp products (14113, 13963, 13965), so the prices are current.
// Needs `vite build` first. Run: node scripts/audit/buy3-e2e.mjs
// (BUY3_SHOTS=<dir> saves screenshots.)
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { createApp } from "../../server/app.mjs"
import { fetchProduct, verifyOrder } from "../../server/orders.mjs"
import { launch, signInPreview, createAccountData, supabaseRef } from "./lib.mjs"

const SHOTS = process.env.BUY3_SHOTS
const db = new PGlite()
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}', is_anonymous boolean not null default false, created_at timestamptz not null default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`)
for (const file of fs.readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) await db.exec(fs.readFileSync(path.join("supabase/migrations", file), "utf8"))
const uid = "00000000-0000-0000-0000-000000000001"
await db.query("insert into auth.users(id,email,is_anonymous) values ($1,'test@example.com',false)", [uid])

// Live products (read-only). 14113: required box choice; 13963 / 13965: plain, on sale.
const live = Object.fromEntries(await Promise.all([14113, 13963, 13965].map(async (id) => [id, await fetchProduct(id)])))
const choice = live[14113].variations.find((v) => v.is_main_price)
const WITHOUT = choice.options.find((o) => o.name.includes("بدون")), WITH = choice.options.find((o) => !o.name.includes("بدون"))
const P = {
  "14113~without": Number(WITHOUT.price_after_discount), "14113~with": Number(WITH.price_after_discount),
  13963: Number(live[13963].price_after_discount), 13965: Number(live[13965].price_after_discount),
}
console.log(`LIVE API 14113 Without box ${P["14113~without"]} (before ${WITHOUT.price_before_discount}), With box ${P["14113~with"]} (before ${WITH.price_before_discount})`)
for (const id of [13963, 13965]) console.log(`LIVE API ${id} ${live[id].name}: ${live[id].price_after_discount} (before ${live[id].price_before_discount}), available ${live[id].is_available}`)
const lineId = { without: `14113~${WITHOUT.id}`, with: `14113~${WITH.id}` }

// Synthetic plain products for the minimum-order interaction (no live product is under EGP 599).
const PLAIN = { 41: [401, null], 42: [599, 1200] }
const fixture = (id) => live[id] ? structuredClone(live[id]) : { id, name: `Fixture ${id}`, description: "100ml", product_type: 1382,
  price_before_discount: PLAIN[id][1], price_after_discount: PLAIN[id][0], is_offer: false, is_available: true, is_variation_available: false,
  image: "https://example.test/bottle.webp", variations: [] }
const catalogue = () => [14113, 13963, 13965, 41, 42].map(fixture)

/** Independent oracle (not the shared module): expand units, cheapest first, ties by line id. */
function oracle(lines) {
  const units = lines.flatMap(([id, price, quantity]) => Array.from({ length: quantity }, () => ({ id, cents: Math.round(price * 100) })))
  units.sort((a, b) => a.cents - b.cents || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const freeUnits = units.slice(0, Math.floor(units.length / 3))
  const free = {}
  for (const u of freeUnits) free[u.id] = (free[u.id] ?? 0) + 1
  const subtotal = units.reduce((s, u) => s + u.cents, 0) / 100
  const discount = freeUnits.reduce((s, u) => s + u.cents, 0) / 100
  return { subtotal, discount, total: subtotal - discount, free, freeCount: freeUnits.length }
}

const asService = (sql, params) => db.transaction(async (tx) => {
  await tx.exec("set local role service_role")
  return (await tx.query(sql, params)).rows[0]
})
const store = {
  authenticate: async (token) => token === "preview" ? { id: uid } : null,
  arabicNames: async () => new Map(),
  save: async (order, owner, fingerprint) => (await asService("select public.store_verified_order($1::jsonb) as saved", [JSON.stringify({ owner, fingerprint, snapshot: order })])).saved,
  claimNotification: async (id) => (await asService("select public.claim_order_notification($1) as claim", [id])).claim,
  finishNotification: async (id, claim, outcome) => (await asService("select public.finish_order_notification($1, $2, $3) as done", [id, claim, outcome])).done,
}
const messages = [], serverLogs = []
const app = createApp({ distDir: path.resolve("dist"), supabaseUrl: `https://${supabaseRef()}.supabase.co`, orderStore: store, getProduct: async (id) => fixture(id),
  orderLimit: { windowMs: 60000, limit: 1000 }, transport: { sendMail: async (mail) => { messages.push(mail) } },
  mail: { from: "Perfumira Test <from@example.test>", to: "sales@example.test" }, trustProxy: false, log: (message, detail) => serverLogs.push({ message, detail }) })
const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)) })
const base = `http://127.0.0.1:${server.address().port}`
const orderCount = async () => Number((await db.query("select count(*)::int as n from public.orders")).rows[0].n)

let checks = 0
const check = (value, label) => { assert.ok(value, label); checks++; console.log("PASS " + label) }
const strip = (text) => text.replace(/[‎‏⁦⁧⁨⁩]/g, "").replace(/[\s ]+/g, " ").trim()
const fmt = (amount, locale) => strip(new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", { style: "currency", currency: "EGP",
  minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount))
const COPY = {
  en: { free: (f, q) => f === q ? "Free" : `${f} of ${q} free`, progress: (n) => `Add ${n} more ${n === 1 ? "item" : "items"} and the cheapest one is free.`,
    name: "Buy 3 — Cheapest Item Free", final: "Final subtotal", tax: "Tax", taxWord: /tax/i,
    minimum: (r) => `Minimum order is EGP 1,000. Add ${fmt(r, "en")} more to continue to checkout.` },
  ar: { free: (f, q) => f === q ? "مجانًا" : `${f} من ${q} مجانًا`, progress: (n) => `أضف ${n === 1 ? "قطعة أخرى" : "قطعتين أخريين"} واحصل على الأقل سعرًا مجانًا.`,
    name: "اشترِ 3 واحصل على الأقل سعرًا مجانًا", final: "المجموع الفرعي النهائي", tax: "الضريبة", taxWord: /ضريب/,
    minimum: (r) => `الحد الأدنى للطلب هو ${fmt(1000, "ar")} أضف منتجات بقيمة ${fmt(r, "ar")} أخرى للمتابعة إلى إتمام الطلب.` },
}

// Real SQL equivalent of the storefront's history select (services/account.ts ORDER_COLUMNS).
const historyRows = async () => (await db.query(`
  select o.id, o.reference, o.created_at, o.status, o.subtotal,
         o.verified_snapshot -> 'displayedTotal' as total, o.verified_snapshot -> 'promotion' as promotion, o.currency,
         coalesce((select json_agg(json_build_object('position', i.position, 'product_ref', i.product_ref, 'product_name', i.product_name,
           'product_name_ar', i.product_name_ar, 'size', i.size, 'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total,
           'image_url', i.image_url) order by i.position) from public.order_items i where i.order_id = o.id), '[]') as order_items
    from public.orders o where o.user_id = $1 order by o.created_at desc`, [uid])).rows

const browser = await launch()
/** A signed-in page whose saved bag is `lines` ([productId, quantity, optionIds]). */
async function openBag(lines, { locale, width, height = 900 }) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" })
  const errors = []; page.on("pageerror", (e) => errors.push(e.message))
  await signInPreview(page, createAccountData("empty"))
  for (const table of ["product_metadata", "product_gallery"]) await page.route(`**/rest/v1/${table}**`, (route) => route.fulfill({ json: [] }))
  await page.route("**/rest/v1/orders**", async (route) => route.fulfill({ json: await historyRows() }))
  const cart = lines.map(([product_id, quantity, option_ids = []]) => ({ product_id, option_ids, quantity }))
  const matches = (url) => (r) => {
    const id = url.searchParams.get("product_id")?.replace("eq.", "")
    const options = url.searchParams.get("option_ids")?.replace("eq.", "")
    return (!id || String(r.product_id) === id) && (!options || options === `{${r.option_ids.join(",")}}`)
  }
  await page.route("**/rest/v1/cart_items**", async (route) => {
    const method = route.request().method(); const url = new URL(route.request().url())
    if (method === "DELETE") {
      const keep = cart.filter((r) => !matches(url)(r)); cart.length = 0; cart.push(...keep)
    }
    if (method === "PATCH") { const line = cart.find(matches(url)); if (line) line.quantity = route.request().postDataJSON().quantity }
    return route.fulfill({ json: cart })
  })
  await page.route("https://api.welpstar.com/**", (route) => {
    const url = new URL(route.request().url()); const products = catalogue()
    const json = url.pathname.endsWith("/all-products") ? { data: [{ name: "Women", products }] } : url.pathname.endsWith("/products") ? { count: products.length, results: products } : { data: fixture(Number(url.pathname.split("/").pop())) }
    return route.fulfill({ json, headers: { "access-control-allow-origin": "*" } })
  })
  for (const host of ["https://example.test/**", "https://wsrv.nl/**", "https://*.welpstar.com/media/**", "https://api.welpstar.com/media/**"]) await page.route(host, (route) => route.fulfill({ path: "public/images/packshots/velvet-iris.webp", contentType: "image/webp" }))
  const prefix = locale === "ar" ? "/ar" : ""
  return { page, errors, url: (p) => base + prefix + p }
}
const text = async (locator) => (await locator.count()) ? strip(await locator.first().innerText()) : null
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
const shot = async (page, name, fullPage = false) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage }) }
const line = (page, id) => page.locator(`.cart-line[data-product-id="${id}"]`)
const plus = (page, id) => line(page, id).locator(".quantity-control button").last()
const minus = (page, id) => line(page, id).locator(".quantity-control button").first()
/** The bag's summary numbers and badges, as shown. */
async function bagState(page, scope = ".cart-page") {
  const root = page.locator(scope)
  const badges = {}
  for (const el of await root.locator("[data-product-id]").all()) {
    const badge = el.locator(".promotion-free__badge")
    // textContent: the copy itself (CSS shows it in capitals).
    if (await badge.count()) badges[await el.getAttribute("data-product-id")] = strip(await badge.textContent())
  }
  return {
    subtotal: await text(root.locator(".order-summary__rows > div").first().locator("dd")),
    promotionName: await text(root.locator(".order-summary__promotion dt")),
    discount: await text(root.locator(".order-summary__promotion dd")),
    final: await text(root.locator(".order-summary__final dd")),
    finalLabel: await text(root.locator(".order-summary__final dt")),
    total: await text(root.locator(".order-summary__total strong")),
    offer: await text(root.locator(".order-summary__offer")),
    // Every summary row as label -> value (tax is always "EGP 0").
    rows: Object.fromEntries(await root.locator(".order-summary__rows > div").evaluateAll((els) => els.map((el) => [el.querySelector("dt"), el.querySelector("dd")].map((n) => n.textContent.replace(/[‎‏⁦-⁩]/g, "").replace(/[\s ]+/g, " ").trim())))),
    fineprint: await text(root.locator(".order-summary__fineprint")),
    badges,
  }
}
/** Waits until the summary total reads `amount`. */
const totalIs = (page, amount, locale, scope = ".order-summary") => page.waitForFunction(([s, want]) => {
  const el = document.querySelector(`${s} .order-summary__total strong`)
  return el && el.textContent.replace(/[‎‏⁦⁧⁨⁩]/g, "").replace(/[\s ]+/g, " ").trim() === want
}, [scope, fmt(amount, locale)], { timeout: 8000 })
function expectBag(state, expected, quantities, locale, tag) {
  const c = COPY[locale]
  check(state.subtotal === fmt(expected.subtotal, locale), `${tag}: subtotal ${state.subtotal}`)
  check(state.total === fmt(expected.total, locale), `${tag}: total ${state.total}`)
  check(state.rows[c.tax] === fmt(0, locale), `${tag}: tax row "${c.tax} ${state.rows[c.tax]}"`)
  check(!Object.keys(state.rows).some((label) => label !== c.tax && c.taxWord.test(label)), `${tag}: one tax row, no "Estimated Tax"`)
  check(!c.taxWord.test(state.fineprint ?? ""), `${tag}: fine print no longer says tax is calculated later`)
  if (expected.discount) {
    check(state.promotionName === c.name && state.discount === `−${fmt(expected.discount, locale)}`, `${tag}: "${state.promotionName}" ${state.discount}`)
    check(state.finalLabel === c.final && state.final === fmt(expected.total, locale), `${tag}: ${state.finalLabel} ${state.final}`)
  } else check(state.discount === null && state.final === null, `${tag}: no discount rows`)
  const wantBadges = Object.fromEntries(Object.entries(expected.free).map(([id, f]) => [id, c.free(f, quantities[id])]))
  check(JSON.stringify(state.badges) === JSON.stringify(wantBadges), `${tag}: free badges ${JSON.stringify(state.badges)}`)
}

try {
  // 1. Live catalogue through the production verifier (real Welp GETs, nothing stored).
  const payload = (lines, displayedTotal, extra = {}) => ({ reference: `PF-B3-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`, locale: "en", currency: "EGP", displayedTotal,
    customer: { fullName: "Test Buyer", phone: "+201001234567", email: "test@example.com" }, delivery: { address: "Test Street", cityArea: "Cairo" },
    lines: lines.map(([welpProductId, unitPrice, quantity, options = []]) => ({ welpProductId, productId: String(welpProductId), name: "x", unitPrice, quantity, options })), ...extra })
  const withPick = [{ variationId: choice.id, optionId: WITH.id }], withoutPick = [{ variationId: choice.id, optionId: WITHOUT.id }]
  const combos = [
    ["3 different products (With box + 13963 + 13965)", [[14113, P["14113~with"], 1, withPick], [13963, P[13963], 1], [13965, P[13965], 1]], [[lineId.with, P["14113~with"], 1], ["13963", P[13963], 1], ["13965", P[13965], 1]]],
    ["3 x the same option (Without box)", [[14113, P["14113~without"], 3, withoutPick]], [[lineId.without, P["14113~without"], 3]]],
    ["option prices: Without + With box + 13963", [[14113, P["14113~without"], 1, withoutPick], [14113, P["14113~with"], 1, withPick], [13963, P[13963], 1]], [[lineId.without, P["14113~without"], 1], [lineId.with, P["14113~with"], 1], ["13963", P[13963], 1]]],
    ["6 units, same-price tie (13965 x2 vs Without box x2 at the same price)", [[13965, P[13965], 2], [13963, P[13963], 2], [14113, P["14113~without"], 2, withoutPick]], [["13965", P[13965], 2], ["13963", P[13963], 2], [lineId.without, P["14113~without"], 2]]],
  ]
  for (const [label, lines, expectLines] of combos) {
    const want = oracle(expectLines)
    const order = await verifyOrder(payload(lines, want.total), { id: uid })
    const free = Object.fromEntries(order.lines.filter((l) => l.freeQuantity).map((l) => [l.productId, l.freeQuantity]))
    console.log(`LIVE ${label}: units ${expectLines.map(([id, p, q]) => `${id}=${p}x${q}`).join(", ")} -> cheapest free ${JSON.stringify(want.free)} -> ${want.subtotal} - ${want.discount} = ${want.total}`)
    check(order.subtotal === want.subtotal && order.promotion?.discount === want.discount && order.displayedTotal === want.total && JSON.stringify(free) === JSON.stringify(want.free),
      `live verify ${label}: ${order.subtotal} - ${order.promotion?.discount} = ${order.displayedTotal}, free ${JSON.stringify(free)}`)
    check(order.lines.every((l) => l.unitPrice > 0 && l.lineTotal === l.unitPrice * l.quantity), `live verify ${label}: unit prices kept (none zeroed)`)
  }
  const saleWant = oracle(combos[0][2])
  check(saleWant.free["13965"] === 1 && saleWant.discount === P[13965] && saleWant.discount !== Number(live[13965].price_before_discount), `sale item 13965: discount = current sale price ${P[13965]}, not before price ${live[13965].price_before_discount}`)
  check(oracle(combos[3][2]).free["13965"] === 2 && !oracle(combos[3][2]).free[lineId.without], "tie at the same price: 13965 (lower line id) gets both free units, deterministically")

  // 2. /api/orders with real SQL + fake mail.
  const post = (body) => fetch(base + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer preview" }, body: JSON.stringify(body) })
  const [threeLines, threeExpect] = [combos[0][1], saleWant]
  for (const [label, build] of [
    ["claims the wrong free product", () => payload(threeLines, threeExpect.subtotal - P[13963], { promotion: { freeUnits: 1, discount: P[13963] } })],
    ["claims a larger discount", () => payload(threeLines, 1, { promotion: { freeUnits: 3, discount: threeExpect.subtotal - 1 } })],
    ["changes a unit price", () => { const b = payload(threeLines, threeExpect.total); b.lines[2].unitPrice = 1; return b }],
    ["sends no promotion (pre-promotion total)", () => payload(threeLines, threeExpect.subtotal)],
  ]) {
    const [orders, mails] = [await orderCount(), messages.length]
    const response = await post(build()); const body = await response.json()
    check(response.status === 409 && body.error === "price_changed" && body.order.displayedTotal === threeExpect.total && body.order.promotion.discount === threeExpect.discount,
      `tampering (${label}): 409 price_changed, server quote ${body.order?.displayedTotal} with its own discount ${body.order?.promotion?.discount}`)
    check(await orderCount() === orders && messages.length === mails, `tampering (${label}): nothing stored or emailed`)
  }
  {
    const body = payload(threeLines, threeExpect.total, { promotion: { freeUnits: 2, discount: 5000 } })
    body.lines[0].freeQuantity = 1
    const response = await post(body); const result = await response.json()
    const row = (await db.query("select subtotal, verified_snapshot from public.orders where reference=$1", [body.reference])).rows[0]
    const items = (await db.query("select product_ref, unit_price, line_total, quantity from public.order_items i join public.orders o on o.id=i.order_id where o.reference=$1 order by position", [body.reference])).rows
    check(response.status === 200 && result.ok, "correct total + forged promotion fields: accepted, forged fields ignored")
    check(Number(row.subtotal) === threeExpect.subtotal, `stored orders.subtotal = verified product subtotal ${row.subtotal}`)
    check(row.verified_snapshot.displayedTotal === threeExpect.total && row.verified_snapshot.promotion.discount === threeExpect.discount && row.verified_snapshot.promotion.freeUnits === 1,
      `stored verified_snapshot: promotion ${JSON.stringify(row.verified_snapshot.promotion)}, displayedTotal ${row.verified_snapshot.displayedTotal}`)
    const freeItem = items.find((i) => i.product_ref === "13965")
    check(Number(freeItem.unit_price) === P[13965] && Number(freeItem.line_total) === P[13965], `stored order_items: free product keeps unit_price ${freeItem.unit_price} (not 0)`)
    check(row.verified_snapshot.lines.find((l) => l.productId === "13965").freeQuantity === 1 && !row.verified_snapshot.lines.find((l) => l.productId === lineId.with).freeQuantity, "stored snapshot marks the free unit on 13965 only")
    const mail = messages.at(-1).text
    console.log("EMAIL BODY (order lines + totals):\n" + mail.split("\n").filter((l) => /\||promotion|subtotal|Subtotal|Buy 3/.test(l)).join("\n"))
    check(mail.includes(`13965 | ${live[13965].name.trim()} | 1 x ${P[13965]} EGP = ${P[13965]} EGP`), "email: free product listed at its real price")
    check(mail.includes(`Buy 3 promotion: 1 of 1 free (discount -${P[13965]} EGP; catalogue price unchanged)`), "email: free unit marked on its line")
    check(mail.includes(`Products subtotal (verified prices, before promotion): ${threeExpect.subtotal} EGP`) && mail.includes(`Buy 3 — Cheapest Item Free (1 free unit, cheapest): -${threeExpect.discount} EGP`)
      && mail.includes(`Payable product subtotal / displayed total: ${threeExpect.total} EGP`), "email: subtotal, discount and payable subtotal")
    check(messages.at(-1).to === "sales@example.test", "email goes to the configured order address")
    check(row.verified_snapshot.tax === 0, `stored verified_snapshot.tax = ${row.verified_snapshot.tax}`)
    check(/^Tax: 0 EGP$/m.test(mail) && !/Shipping and tax/i.test(mail), "email: Tax: 0 EGP, shipping still to be confirmed")
  }
  // Minimum after the promotion (synthetic prices: nothing live is under EGP 599).
  {
    const [orders, mails] = [await orderCount(), messages.length]
    const response = await post(payload([[41, 401, 3]], 802)); const body = await response.json()
    check(response.status === 422 && body.error === "minimum_order_not_met" && body.subtotal === 802 && body.productSubtotal === 1203 && body.discount === 401, "minimum: 1,203 before, 802 after the promotion -> 422")
    check(await orderCount() === orders && messages.length === mails, "minimum: nothing stored or emailed")
    const ok = await post(payload([[42, 599, 1], [41, 401, 2]], 1000))
    check(ok.status === 200 && (await ok.json()).order.displayedTotal === 1000, "minimum: 1,401 - 401 = exactly 1,000 -> stored")
  }

  // 3. Browser: EN/AR, desktop/mobile.
  for (const locale of ["en", "ar"]) for (const width of [1440, 390]) {
    const tag = `${locale}/${width}`, v = { locale, width }, c = COPY[locale]

    // Progress, quantity updates, removal.
    let { page, errors, url } = await openBag([[13965, 1], [13963, 1]], v)
    await page.goto(url("/cart"), { waitUntil: "networkidle" })
    await line(page, "13965").waitFor()
    let s = await bagState(page)
    expectBag(s, oracle([["13965", P[13965], 1], ["13963", P[13963], 1]]), {}, locale, `${tag} 2 units`)
    check(s.offer === c.progress(1), `${tag} 2 units: progress "${s.offer}"`)
    await shot(page, `${tag.replace("/", "-")}-2-units`)
    await plus(page, "13963").click()
    let want = oracle([["13965", P[13965], 1], ["13963", P[13963], 2]])
    await totalIs(page, want.total, locale)
    s = await bagState(page)
    expectBag(s, want, { 13965: 1, 13963: 2 }, locale, `${tag} quantity 1 -> 2 (3 units)`)
    check(s.offer === null, `${tag} 3 units: progress note gone`)
    if (width === 390) {
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200)
      check(strip(await page.locator(".mobile-checkout__bar strong").innerText()) === fmt(want.total, locale), `${tag} mobile bar shows the promotion total`)
    }
    await plus(page, "13965").click()
    want = oracle([["13965", P[13965], 2], ["13963", P[13963], 2]])
    await page.waitForFunction((t) => document.querySelector('.cart-line[data-product-id="13965"] .promotion-free__badge')?.textContent.trim() === t, c.free(1, 2))
    expectBag(await bagState(page), want, { 13965: 2, 13963: 2 }, locale, `${tag} 4 units`)
    await line(page, "13965").locator(".cart-line__remove").click()
    want = oracle([["13963", P[13963], 2]])
    await totalIs(page, want.total, locale)
    s = await bagState(page)
    expectBag(s, want, {}, locale, `${tag} free item removed (2 units left)`)
    check(s.offer === c.progress(1), `${tag} after removal: progress "${s.offer}"`)
    await minus(page, "13963").click()
    await totalIs(page, P[13963], locale)
    check((await bagState(page)).offer === c.progress(2), `${tag} 1 unit: "${c.progress(2)}"`)
    check(errors.length === 0, `${tag} no uncaught errors (recalculation)`)
    await page.close()

    // Real 3-product bag -> checkout -> stored order -> history.
    ;({ page, errors, url } = await openBag([[14113, 1, [WITH.id]], [13963, 1], [13965, 1]], v))
    await page.goto(url("/cart"), { waitUntil: "networkidle" })
    want = oracle([[lineId.with, P["14113~with"], 1], ["13963", P[13963], 1], ["13965", P[13965], 1]])
    await totalIs(page, want.total, locale)
    const cartState = await bagState(page)
    expectBag(cartState, want, { 13965: 1 }, locale, `${tag} live 3-product bag`)
    const badgeAmount = await text(line(page, "13965").locator(".promotion-free__amount"))
    check(badgeAmount === `−${fmt(P[13965], locale)}`, `${tag} free line shows ${badgeAmount}`)
    check(strip(await line(page, "13965").locator(".cart-line__price").innerText()).startsWith(fmt(P[13965], locale)), `${tag} free line keeps its price ${fmt(P[13965], locale)}`)
    check(await noOverflow(page), `${tag} bag: no horizontal overflow`)
    await shot(page, `${tag.replace("/", "-")}-bag-3`, true)
    await page.locator(".order-summary__checkout").click()
    await page.waitForURL(/\/checkout$/)
    await page.locator(".checkout-form").waitFor()
    const checkoutState = await bagState(page, ".checkout-summary")
    expectBag(checkoutState, want, { 13965: 1 }, locale, `${tag} checkout summary`)
    check(JSON.stringify({ ...checkoutState, offer: null, fineprint: null, rows: checkoutState.rows[c.tax] }) === JSON.stringify({ ...cartState, offer: null, fineprint: null, rows: cartState.rows[c.tax] }), `${tag} cart and checkout totals identical`)
    check(await noOverflow(page), `${tag} checkout: no horizontal overflow`)
    await shot(page, `${tag.replace("/", "-")}-checkout-3`, true)
    for (const [key, value] of Object.entries({ fullName: "Test Buyer", phone: "+201001234567", email: "test@example.com", address: "Test Street", cityArea: "Cairo" })) await page.locator(`.checkout-form [name=${key}]`).fill(value)
    const [orders, mails] = [await orderCount(), messages.length]
    await page.locator('.checkout-form button[type="submit"]').click()
    await page.locator(".checkout-confirmation").waitFor()
    check(await orderCount() === orders + 1 && messages.length === mails + 1, `${tag} order submitted through the UI: stored + one email`)
    const stored = (await db.query("select subtotal, verified_snapshot from public.orders order by updated_at desc limit 1")).rows[0]
    check(Number(stored.subtotal) === want.subtotal && stored.verified_snapshot.displayedTotal === want.total && stored.verified_snapshot.promotion.discount === want.discount, `${tag} stored: ${stored.subtotal} - ${stored.verified_snapshot.promotion.discount} = ${stored.verified_snapshot.displayedTotal}`)
    check(stored.verified_snapshot.tax === 0 && stored.verified_snapshot.displayedTotal === stored.verified_snapshot.subtotal - stored.verified_snapshot.promotion.discount, `${tag} stored tax 0; total = post-promotion subtotal (no tax added)`)
    check(/^Tax: 0 EGP$/m.test(messages.at(-1).text), `${tag} UI order email: Tax: 0 EGP`)
    expectBag(await bagState(page, ".checkout-summary"), want, { 13965: 1 }, locale, `${tag} confirmation summary (server numbers)`)
    await shot(page, `${tag.replace("/", "-")}-confirmation`, true)
    check(errors.length === 0, `${tag} no uncaught errors (checkout)`)
    await page.goto(url("/account/orders"), { waitUntil: "networkidle" })
    await page.locator(".order-list__total").first().waitFor()
    check(strip(await page.locator(".order-list__total").first().innerText()).endsWith(fmt(want.total, locale)), `${tag} order history total ${fmt(want.total, locale)}`)
    check(await text(page.locator(".order-list > li").first().locator(".order-list__promotion")) === `${c.name} −${fmt(want.discount, locale)}`, `${tag} order history shows the promotion`)
    check(await noOverflow(page), `${tag} order history: no horizontal overflow`)
    await shot(page, `${tag.replace("/", "-")}-history`)
    await page.close()

    // 6 units: two free (same-price tie decided by line id).
    ;({ page, errors, url } = await openBag([[13965, 2], [13963, 2], [14113, 2, [WITHOUT.id]]], v))
    await page.goto(url("/cart"), { waitUntil: "networkidle" })
    want = oracle([["13965", P[13965], 2], ["13963", P[13963], 2], [lineId.without, P["14113~without"], 2]])
    await totalIs(page, want.total, locale)
    expectBag(await bagState(page), want, { 13965: 2 }, locale, `${tag} 6 units`)
    check(want.freeCount === 2, `${tag} 6 units: 2 free units`)
    await page.close()

    // Minimum order after the promotion (synthetic EGP 401).
    ;({ page, errors, url } = await openBag([[41, 3]], v))
    await page.goto(url("/cart"), { waitUntil: "networkidle" })
    await totalIs(page, 802, locale)
    expectBag(await bagState(page), oracle([["41", 401, 3]]), { 41: 3 }, locale, `${tag} 3 x 401`)
    await page.locator(".order-summary__checkout").click(); await page.waitForTimeout(200)
    check(/\/cart$/.test(page.url()) && await text(page.locator(".order-summary__minimum p")) === strip(c.minimum(198)), `${tag} 1,203 before / 802 after: Checkout blocked, EGP 198 more`)
    await shot(page, `${tag.replace("/", "-")}-minimum`)
    await page.goto(url("/checkout"), { waitUntil: "networkidle" })
    await page.waitForURL(/\/cart$/)
    check(await page.locator(".checkout-form").count() === 0, `${tag} direct /checkout after promotion below minimum: back to the bag`)
    await page.close()
    ;({ page, errors, url } = await openBag([[42, 1], [41, 2]], v))
    await page.goto(url("/cart"), { waitUntil: "networkidle" })
    await totalIs(page, 1000, locale)
    await page.locator(".order-summary__checkout").click()
    await page.waitForURL(/\/checkout$/)
    await page.locator(".checkout-form").waitFor({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(300)
    if (!(await page.locator(".checkout-form").count())) console.log("DIAGNOSTIC", page.url(), strip(await page.locator("main").innerText().catch(() => "")).slice(0, 300))
    check(/\/checkout$/.test(page.url()) && await page.locator(".checkout-form").count() === 1, `${tag} 1,401 - 401 = 1,000: Checkout allowed (form shown, no redirect back)`)
    check(errors.length === 0, `${tag} no uncaught errors (minimum)`)
    await page.close()
  }
  const logText = JSON.stringify(serverLogs)
  check(!logText.includes("Test Street") && !logText.includes("test@example.com"), "server logs carry no address or email")
  console.log(`${checks} checks passed; ${messages.length} mock emails; ${await orderCount()} orders in the in-memory database; no live writes`)
} finally {
  await browser.close(); await new Promise((resolve) => server.close(resolve)); await db.close()
}
