// Editing a stored order: no-change state, change then revert, Save Changes
// (no email), Send Updated Order, Save & Send with order edits (quantity,
// removed) on the order page, never the bag, and the email's Order Changes, EN/AR at 1440 and 390.
// Same isolation as buy4-e2e.mjs (generated from its harness): Express +
// real SQL migrations (PGlite) + fake mail; read-only GETs of live Welp.
// Needs `vite build` first. Run: node scripts/audit/order-edit-e2e.mjs
// (BUY4_SHOTS=<dir> screenshots, EDIT_SAMPLES=<dir> the emails.)
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { createApp } from "../../server/app.mjs"
import { fetchProduct, verifyOrder } from "../../server/orders.mjs"
import { createOrderRules } from "../../server/orderRules.mjs"
import { launch, signInPreview, createAccountData, supabaseRef } from "./lib.mjs"

const SHOTS = process.env.BUY4_SHOTS
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
const PLAIN = { 41: [401, null], 42: [599, 1200], 43: [300, null] }
const fixture = (id) => live[id] ? structuredClone(live[id]) : { id, name: `Fixture ${id}`, description: "100ml", product_type: 1382,
  price_before_discount: PLAIN[id][1], price_after_discount: PLAIN[id][0], is_offer: false, is_available: true, is_variation_available: false,
  image: "https://example.test/bottle.webp", variations: [] }
const catalogue = () => [14113, 13963, 13965, 41, 42, 43].map(fixture)

/** Independent oracle (not the shared module): expand units, cheapest first, ties by line id. */
function oracle(lines) {
  const units = lines.flatMap(([id, price, quantity]) => Array.from({ length: quantity }, () => ({ id, cents: Math.round(price * 100) })))
  units.sort((a, b) => a.cents - b.cents || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const freeUnits = units.slice(0, Math.floor(units.length / 4))
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
  current: async (owner, reference) => (await db.query("select revision, notification_status, verified_snapshot from public.orders where user_id = $1 and reference = $2", [owner, reference])).rows[0] ?? null,
  claimNotification: async (id) => (await asService("select public.claim_order_notification($1) as claim", [id])).claim,
  finishNotification: async (id, claim, outcome) => (await asService("select public.finish_order_notification($1, $2, $3) as done", [id, claim, outcome])).done,
}
const messages = [], serverLogs = []
// The minimum order is read from Welp in production; here it is a Welp value
// of EGP 1,000 (through the real rules module), which the messages below assume.
// minimum-order-e2e.mjs covers other values and failures.
const orderRules = createOrderRules({ fetchMinimum: async () => 1000 })
const app = createApp({ orderRules, distDir: path.resolve("dist"), supabaseUrl: `https://${supabaseRef()}.supabase.co`, orderStore: store, getProduct: async (id) => fixture(id),
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
    name: "Buy 3, Get the 4th Free", final: "Final subtotal", tax: "Tax", taxWord: /tax/i,
    minimum: (r) => `Minimum order is EGP 1,000. Add ${fmt(r, "en")} more to continue to checkout.` },
  ar: { free: (f, q) => f === q ? "مجانًا" : `${f} من ${q} مجانًا`, progress: (n) => `أضف ${n === 1 ? "قطعة أخرى" : n === 2 ? "قطعتين أخريين" : `${n} قطع أخرى`} واحصل على الأقل سعرًا مجانًا.`,
    name: "اشترِ 3 واحصل على الرابع مجانًا", final: "المجموع الفرعي النهائي", tax: "الضريبة", taxWord: /ضريب/,
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
    if (method === "POST") { for (const r of [].concat(route.request().postDataJSON())) { const line = cart.find((c) => c.product_id === r.product_id && String(c.option_ids) === String(r.option_ids ?? [])); if (line) line.quantity = r.quantity; else cart.push({ product_id: r.product_id, option_ids: r.option_ids ?? [], quantity: r.quantity }) } }
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
  return { page, errors, cart, url: (p) => base + prefix + p }
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


// ---------------------------------------------------------------------------
// Order edit flow (Edit Details on the confirmation).
const SAMPLES = process.env.EDIT_SAMPLES
const EDIT = {
  en: { editDetails: "Edit Details", noChanges: /^No changes yet\./, back: "Back to Your Order", saveAndSend: "Save & Send Updated Order", save: "Save Changes",
    received: "Order request received", saved: "Changes saved", updated: "Order request updated", send: "Send Updated Order", unchanged: /already has this version/ },
  ar: { editDetails: "تعديل البيانات", noChanges: /^لا توجد تغييرات بعد\./, back: "العودة إلى طلبك", saveAndSend: "حفظ وإرسال الطلب المعدّل", save: "حفظ التغييرات",
    received: "تم استلام طلب الشراء", saved: "تم حفظ التغييرات", updated: "تم تحديث طلب الشراء", send: "إرسال الطلب المعدّل", unchanged: /لدى فريقنا هذه النسخة بالفعل/ },
}
const lastRow = async () => (await db.query("select reference, revision, notification_status, verified_snapshot from public.orders order by updated_at desc limit 1")).rows[0]
const sample = (name, text) => { if (SAMPLES) fs.writeFileSync(path.join(SAMPLES, name + ".txt"), text) }
try {
  for (const locale of ["en", "ar"]) for (const width of [1440, 390]) {
    const tag = `${locale}/${width}`, v = { locale, width }, e = EDIT[locale]
    const { page, errors, url, cart } = await openBag([[13965, 1], [13963, 1]], v)
    const submitButtons = () => page.locator(".checkout-form button[type=submit]")
    const heading = () => text(page.locator(".checkout-confirmation h2"))
    const fill = async (values) => { for (const [k, val] of Object.entries(values)) await page.locator(`.checkout-form [name=${k}]`).fill(val) }
    const details = { fullName: "Test Buyer", phone: "+201001234567", email: "test@example.com", address: "Test Street 12", cityArea: "Cairo" }

    // 1. A first request: one email.
    await page.goto(url("/cart"), { waitUntil: "networkidle" })
    await page.locator(".order-summary__checkout").click()
    await page.waitForURL(/\/checkout$/)
    await page.locator(".checkout-form").waitFor()
    check(await page.locator(".checkout-edit").count() === 0, `${tag} new order: no edit actions, one submit`)
    await fill(details)
    let mails = messages.length
    await submitButtons().first().click()
    await page.locator(".checkout-confirmation").waitFor()
    check(await heading() === e.received && messages.length === mails + 1, `${tag} first request stored + emailed`)
    const reference = (await lastRow()).reference

    // 2. Edit, nothing changed: no save or send actions.
    await page.getByRole("button", { name: e.editDetails }).click()
    await page.locator(".checkout-form").waitFor()
    const clean = async (label) => {
      check(await submitButtons().count() === 0 && e.noChanges.test(await text(page.locator(".checkout-edit__note")) ?? ""), `${tag} ${label}: clean, no Save / Send`)
    }
    await clean("opened, unchanged")
    check(await page.locator(".checkout-form [name=phone]").inputValue() === details.phone, `${tag} edit form keeps the stored details`)
    await shot(page, `${tag.replace("/", "-")}-edit-clean`, true)

    // 3. Change then revert: back to clean. Spacing-only: still clean.
    await page.locator(".checkout-form [name=phone]").fill("+201112223334")
    check(await submitButtons().count() === 2 && await text(submitButtons().first()) === e.saveAndSend && await text(submitButtons().nth(1)) === e.save, `${tag} after a real change: "${e.saveAndSend}" + "${e.save}"`)
    await shot(page, `${tag.replace("/", "-")}-edit-dirty`, true)
    await page.locator(".checkout-form [name=phone]").fill(details.phone)
    await clean("changed then reverted")
    await page.locator(".checkout-form [name=fullName]").fill("  Test   Buyer ")
    await page.locator(".checkout-form [name=phone]").fill("+20 100 123 4567")
    await clean("spacing / phone punctuation only")
    await page.locator(".checkout-form [name=fullName]").fill(details.fullName)
    await page.locator(".checkout-form [name=phone]").fill(details.phone)

    // 4. Back to the order without saving.
    await page.getByRole("button", { name: e.back }).click()
    check(await heading() === e.received, `${tag} "${e.back}" returns to the confirmation`)
    await page.getByRole("button", { name: e.editDetails }).click()

    // 5. Save Changes: stored, no email.
    await page.locator(".checkout-form [name=phone]").fill("+201112223334")
    mails = messages.length
    await submitButtons().nth(1).click()
    await page.locator(".checkout-confirmation").waitFor()
    let row = await lastRow()
    check(await heading() === e.saved && messages.length === mails, `${tag} Save Changes: "${await heading()}", no email`)
    check(row.reference === reference && row.revision === 2 && row.notification_status === "pending" && row.verified_snapshot.customer.phone === "+201112223334", `${tag} Save Changes: same reference, revision 2 stored, pending`)
    await shot(page, `${tag.replace("/", "-")}-saved`, true)

    // 6. Send Updated Order: one email listing the change.
    await page.getByRole("button", { name: e.send }).click()
    await page.waitForFunction((h) => document.querySelector(".checkout-confirmation h2")?.textContent.trim() === h, e.updated)
    check(messages.length === mails + 1, `${tag} Send Updated Order: one email`)
    let mail = messages.at(-1).text
    check(mail.includes("ORDER CHANGES (compared with version 1, the last version emailed to the team):") && mail.includes(`- Phone: "+201001234567" → "+201112223334"`) && mail.includes("CURRENT ORDER (complete, after the changes):"), `${tag} email: Order Changes, phone old → new, then the current order`)
    sample(`${tag.replace("/", "-")}-1-phone`, mail)
    await shot(page, `${tag.replace("/", "-")}-sent`, true)

    // 7. Order edits (2026-11-20: on the order itself, never the bag): the bag
    // is empty after the order; quantity +1, then a line removed + a note.
    check(cart.length === 0 && await page.locator(".header-actions .icon-button__badge").last().innerText() === "0", `${tag} shopping bag emptied by the order`)
    await page.reload({ waitUntil: "networkidle" })
    await page.locator(".checkout-confirmation").waitFor()
    check(await heading() === e.updated && await text(page.locator(".checkout-confirmation__code")) === reference, `${tag} order page survives a reload`)
    await page.getByRole("button", { name: e.editDetails }).click()
    await page.locator(".order-edit").waitFor()
    check(await page.locator(".order-edit__line").count() === 2 && await page.locator(".checkout-form [name=phone]").inputValue() === "+201112223334", `${tag} edit loads the stored lines and details with an empty bag`)
    await page.locator('.order-edit__line[data-product-id="13963"] .quantity-control button').last().click()
    check(await submitButtons().count() === 2, `${tag} quantity changed: save actions shown`)
    mails = messages.length
    await submitButtons().first().click()
    await page.locator(".checkout-confirmation").waitFor()
    check(await heading() === e.updated && messages.length === mails + 1 && cart.length === 0, `${tag} Save & Send: one email, bag still empty`)
    mail = messages.at(-1).text
    const name13963 = live[13963].name.trim()
    check(mail.includes(`- Quantity, ${name13963}: 1 → 2`) && /- Total: [\d.]+ EGP → [\d.]+ EGP/.test(mail) && !mail.includes("- Phone:"), `${tag} email: quantity 1 → 2, total; phone not repeated`)
    sample(`${tag.replace("/", "-")}-2-quantity`, mail)
    row = await lastRow()
    check(row.revision === 3 && row.verified_snapshot.lines.find((l) => l.productId === "13963").quantity === 2, `${tag} stored revision 3 (Send after Save adds none), quantity 2`)

    await page.getByRole("button", { name: e.editDetails }).click()
    await page.locator(".order-edit").waitFor()
    await page.locator('.order-edit__line[data-product-id="13965"] .order-edit__remove').click()
    await page.locator(".checkout-form [name=notes]").fill("Ring twice, please")
    mails = messages.length
    await submitButtons().first().click()
    await page.locator(".checkout-confirmation").waitFor()
    mail = messages.at(-1).text
    check(messages.length === mails + 1 && mail.includes(`- Product removed: ${live[13965].name.trim()} (quantity 1)`) && mail.includes(`- Order note: (empty) → "Ring twice, please"`), `${tag} email: product removed + order note`)
    sample(`${tag.replace("/", "-")}-3-remove-note`, mail)

    // 8. Saved, then changed back, then sent: nothing new for the team.
    await page.getByRole("button", { name: e.editDetails }).click()
    await page.locator(".checkout-form [name=cityArea]").fill("Giza")
    await submitButtons().nth(1).click()
    await page.locator(".checkout-confirmation").waitFor()
    await page.getByRole("button", { name: e.editDetails }).click()
    await page.locator(".checkout-form [name=cityArea]").fill("Cairo")
    mails = messages.length
    await submitButtons().first().click()
    await page.locator(".checkout-confirmation").waitFor()
    check(messages.length === mails && e.unchanged.test(await text(page.locator(".checkout-confirmation__status dd")) ?? ""), `${tag} reverted before sending: no email, "already has this version"`)
    check(await noOverflow(page), `${tag} no horizontal overflow`)
    check(errors.length === 0, `${tag} no uncaught errors`)
    await page.close()
  }
  console.log(`${checks} checks passed; ${messages.length} mock emails; no live writes`)
} finally {
  await browser.close(); await new Promise((resolve) => server.close(resolve)); await db.close()
}
