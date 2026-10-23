// Isolated browser -> Express -> verifier -> real SQL migrations -> history.
// No live writes or SMTP: public catalogue-shaped fixtures and a fake transport.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { createApp } from "../../server/app.mjs"
import { launch, signInPreview, createAccountData } from "./lib.mjs"

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
const guestId = "00000000-0000-0000-0000-000000000002"
await db.query("insert into auth.users(id,email,is_anonymous) values ($1,'test@example.com',false),($2,null,true)", [uid, guestId])
// An approved Arabic name for the boxed fixture, read by the server from product_metadata.
const ARABIC_NAME = "عطر تجريبي معتمد"
await db.query("insert into public.product_metadata(business_id, product_id, name_ar) values (84116, 21, $1)", [ARABIC_NAME])
let price = 900, unavailable = false, failStorage = false, failSMTP = false
const messages = [], serverLogs = []
// Like the live catalogue: English product names, Arabic option labels, no currency.
const fixture = (id) => ({ id, name: id === 21 ? "Boxed Fixture" : "Plain Fixture", description: "100ml", product_type: id === 21 ? 1382 : 1344,
  price_after_discount: 1100, is_available: !unavailable, is_variation_available: id === 21,
  image: "https://example.test/bottle.webp",
  variations: id === 21 ? [{ id: 4800, name: "اختار", is_required: true, is_main_price: true, is_select_multiple: false, max_selection: 1,
    options: [{ id: 12203, name: "بدون علبة", price_after_discount: price }, { id: 12202, name: "بالعلبه", price_after_discount: 1100 }] }] : [] })
const asService = (sql, params) => db.transaction(async (tx) => {
  await tx.exec("set local role service_role")
  return (await tx.query(sql, params)).rows[0]
})
const store = {
  authenticate: async (token) => token === "preview" ? { id: uid } : token === "guest-test" ? { id: guestId, is_anonymous: true } : null,
  arabicNames: async (ids) => new Map((await db.query("select product_id, name_ar from public.product_metadata where business_id = 84116 and product_id = any($1) and name_ar is not null", [ids])).rows.map((row) => [Number(row.product_id), row.name_ar])),
  save: async (order, owner, fingerprint) => {
    if (failStorage) throw new Error("storage offline")
    return (await asService("select public.store_verified_order($1::jsonb) as saved", [JSON.stringify({ owner, fingerprint, snapshot: order })])).saved
  },
  claimNotification: async (id) => (await asService("select public.claim_order_notification($1) as claim", [id])).claim,
  finishNotification: async (id, claim, outcome) => (await asService("select public.finish_order_notification($1, $2, $3) as done", [id, claim, outcome])).done,
}
// Production keeps 20 orders per 15 minutes; these 12 scenarios post more than that from one address.
const app = createApp({ distDir: path.resolve("dist"), orderStore: store, getProduct: async (id) => fixture(id), orderLimit: { windowMs: 60000, limit: 1000 }, transport: { sendMail: async (mail) => { if (failSMTP) throw Object.assign(new Error("mock SMTP offline"), { code: "ECONNECTION", command: "CONN" }); messages.push(mail) } }, mail: { from: "Perfumira Test <from@example.test>", to: "orders@example.test" }, trustProxy: false, log: (message, detail) => serverLogs.push({ message, detail }) })
const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)) })
const base = `http://127.0.0.1:${server.address().port}`
const browser = await launch()
let checks = 0
const check = (value, label) => { assert.ok(value, label); checks++; console.log("PASS " + label) }
try {
  for (const locale of ["en", "ar"]) for (const width of [1440, 768, 390]) for (const guest of [false, true]) {
    const tag = `${locale}/${width}/${guest ? "guest" : "customer"}`
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" })
    const errors = []; page.on("pageerror", (e) => errors.push(e.message))
    await signInPreview(page, createAccountData("empty"))
    await page.route("**/rest/v1/product_metadata**", (route) => route.fulfill({ json: [] }))
    await page.route("**/rest/v1/product_gallery**", (route) => route.fulfill({ json: [] }))
    if (guest) await page.addInitScript((guestId) => {
      for (const key of Object.keys(localStorage).filter((k) => k.endsWith("-auth-token"))) {
        const session = JSON.parse(localStorage.getItem(key)); session.access_token = "guest-test"; session.user.id = guestId; session.user.is_anonymous = true; session.user.email = null; localStorage.setItem(key, JSON.stringify(session))
      }
    }, guestId)
    const cart = []
    await page.route("**/rest/v1/cart_items**", async (route) => {
      const method = route.request().method(); const url = new URL(route.request().url())
      if (method === "DELETE") cart.length = 0
      if (method === "PATCH") { const line = cart.find((r) => String(r.product_id) === url.searchParams.get("product_id")?.replace("eq.", "")); if (line) line.quantity = route.request().postDataJSON().quantity }
      return route.fulfill({ json: cart })
    })
    await page.route("**/rest/v1/rpc/add_cart_item", async (route) => {
      const body = route.request().postDataJSON()
      let line = cart.find((r) => r.product_id === body.p_product_id && JSON.stringify(r.option_ids) === JSON.stringify(body.p_option_ids))
      if (line) line.quantity = Math.min(10, line.quantity + body.p_quantity)
      else { line = { product_id: body.p_product_id, option_ids: body.p_option_ids, quantity: body.p_quantity }; cart.push(line) }
      return route.fulfill({ json: line })
    })
    await page.route("**/rest/v1/orders**", async (route) => {
      const rows = await db.transaction(async (tx) => {
        await tx.exec("set local role authenticated")
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [guest ? guestId : uid])
        await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ is_anonymous: guest })])
        return (await tx.query("select o.*, coalesce((select jsonb_agg(i) from public.order_items i where i.order_id=o.id),'[]') as order_items from public.orders o order by created_at desc")).rows
      })
      return route.fulfill({ json: rows })
    })
    await page.route("https://api.welpstar.com/**", (route) => {
      const url = new URL(route.request().url()); const products = [fixture(21), fixture(19)]
      const json = url.pathname.endsWith("/all-products") ? { data: [{ name: "Women", products }] } : url.pathname.endsWith("/products") ? { count: 2, results: products } : { data: fixture(Number(url.pathname.split("/").pop())) }
      return route.fulfill({ json, headers: { "access-control-allow-origin": "*" } })
    })
    await page.route("https://example.test/**", (route) => route.fulfill({ path: "public/images/packshots/velvet-iris.webp", contentType: "image/webp" }))
    await page.route("https://wsrv.nl/**", (route) => route.fulfill({ path: "public/images/packshots/velvet-iris.webp", contentType: "image/webp" }))
    const prefix = locale === "ar" ? "/ar" : ""
    await page.goto(base + prefix + "/", { waitUntil: "networkidle" })
    check(await page.locator(".testimonials").count() === 0, tag + " no fake testimonials")
    await page.goto(base + prefix + "/products/product-21", { waitUntil: "networkidle" })
    if (!await page.locator("input[data-product-option]").count()) console.log("PDP diagnostic", await page.locator("#main").innerText(), errors)
    await page.locator("input[data-product-option]").first().check()
    await page.locator(".pdp__add").click()
    await page.locator(".pdp__add").click()
    await page.locator('.header-actions a[href$="/cart"]').click()
    await page.locator(".cart-line").waitFor()
    await page.reload({ waitUntil: "networkidle" })
    check(await page.locator(".cart-line").count() === 1, tag + " cart reload persisted")
    await page.locator(".order-summary__checkout").click()
    const fields = { fullName: "Test Buyer", phone: "+201001234567", email: "test@example.com", address: "Test Street", cityArea: "Cairo" }
    for (const [key, value] of Object.entries(fields)) await page.locator(`.checkout-form [name=${key}]`).fill(value)
    price = 950
    const submit = page.locator('.checkout-form button[type="submit"]')
    /** Submits; when the store quotes new prices, checks the quote and confirms it. */
    const submitConfirmingQuote = async () => {
      await submit.click()
      await page.waitForFunction(() => document.querySelector('.checkout-form button[type="submit"]')?.textContent.match(/Confirm Updated|تأكيد الإجمالي/))
      check(await page.locator(".checkout-confirmation").count() === 0, tag + " price change requires confirmation")
      const quoted = (await page.locator(".checkout-quote__total").innerText()).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, "")
      check(quoted.includes("1900"), tag + " quote shows the store total")
      await submit.click()
      await page.locator(".checkout-confirmation").waitFor()
    }
    failSMTP = guest
    const sentBefore = messages.length
    await submitConfirmingQuote()
    const ref = (await page.locator(".checkout-confirmation__code").innerText()).trim()
    const row = (await db.query("select * from public.orders where reference=$1 and user_id=$2", [ref, guest ? guestId : uid])).rows[0]
    check(Number(row.subtotal) === 1900 && row.currency === "EGP" && row.revision === 1, tag + " stored authoritative total in EGP")
    const wa = new URL(await page.locator('.checkout-confirmation a[href^="https://wa.me/"]').getAttribute("href"))
    const waText = wa.searchParams.get("text")
    check(wa.pathname === "/201278166686" && waText.includes(ref) && (locale === "ar" ? waText.includes(ARABIC_NAME) && waText.includes("بدون علبة") : waText.includes("Boxed Fixture (Without box)")), tag + " WhatsApp uses the stored reference, name and option in the checkout language")
    check(row.notification_status === (guest ? "failed" : "sent"), tag + " notification status durable")
    if (guest) check(serverLogs.some((l) => l.message === "Order notification failed" && l.detail.category === "smtp" && l.detail.code === "ECONNECTION" && l.detail.reference === ref), tag + " SMTP failure logged with safe fields")
    else {
      const mail = messages[messages.length - 1]
      check(messages.length === sentBefore + 1 && mail.to === "orders@example.test" && mail.subject === `Perfumira Website – New Order – ${ref}` && mail.text.includes("Boxed Fixture (Without box)"), tag + " company email from MAIL settings with canonical names")
      // Edit Details, change the city, resubmit: same reference, revision 2, an "updated" email.
      await page.locator(".checkout-confirmation__actions button").click()
      await page.locator('.checkout-form [name=cityArea]').fill("Giza")
      await submitConfirmingQuote()
      check((await page.locator(".checkout-confirmation__code").innerText()).trim() === ref, tag + " edited order keeps its reference")
      check((await page.locator(".checkout-confirmation h2").innerText()).match(/Order request updated|تم تحديث طلب الشراء/), tag + " confirmation says the order was updated")
      const editedRow = (await db.query("select * from public.orders where reference=$1 and user_id=$2", [ref, uid])).rows
      check(editedRow.length === 1 && editedRow[0].revision === 2 && editedRow[0].city_area === "Giza" && editedRow[0].notification_status === "sent", tag + " edit stored in place as revision 2")
      const update = messages[messages.length - 1]
      check(messages.length === sentBefore + 2 && update.subject === `Perfumira Website – Updated Order – ${ref}` && update.text.startsWith("UPDATED ORDER"), tag + " company notified of the update")
      await page.goto(base + prefix + "/account/orders", { waitUntil: "networkidle" }); await page.reload({ waitUntil: "networkidle" })
      const history = await page.locator(".order-list").innerText()
      check(history.includes(ref) && history.includes(locale === "ar" ? ARABIC_NAME : "Boxed Fixture (Without box)"), tag + " real SQL history readback after reload, in the page language")
    }
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), tag + " no overflow")
    check(errors.length === 0, tag + " no uncaught errors")
    await page.close(); price = 900; failSMTP = false
  }
  // Refusals shown in the page language: an unavailable product, then the rate limit.
  for (const locale of ["en", "ar"]) {
    const tag = `${locale}/390/refusals`
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: "reduce" })
    await signInPreview(page, createAccountData("empty"))
    for (const table of ["product_metadata", "product_gallery", "orders"]) await page.route(`**/rest/v1/${table}**`, (route) => route.fulfill({ json: [] }))
    const cart = [{ product_id: 19, option_ids: [], quantity: 1 }]
    await page.route("**/rest/v1/cart_items**", (route) => route.fulfill({ json: cart }))
    await page.route("https://api.welpstar.com/**", (route) => {
      const url = new URL(route.request().url()); const products = [fixture(21), { ...fixture(19), is_available: true }]
      const json = url.pathname.endsWith("/all-products") ? { data: [{ name: "Women", products }] } : url.pathname.endsWith("/products") ? { count: 2, results: products } : { data: fixture(Number(url.pathname.split("/").pop())) }
      return route.fulfill({ json, headers: { "access-control-allow-origin": "*" } })
    })
    await page.route("https://example.test/**", (route) => route.fulfill({ path: "public/images/packshots/velvet-iris.webp", contentType: "image/webp" }))
    await page.route("https://wsrv.nl/**", (route) => route.fulfill({ path: "public/images/packshots/velvet-iris.webp", contentType: "image/webp" }))
    await page.goto(base + (locale === "ar" ? "/ar" : "") + "/checkout", { waitUntil: "networkidle" })
    for (const [key, value] of Object.entries({ fullName: "Test Buyer", phone: "+201001234567", email: "test@example.com", address: "Test Street", cityArea: "Cairo" })) await page.locator(`.checkout-form [name=${key}]`).fill(value)
    const status = page.locator(".checkout-form .auth-status")
    unavailable = true
    await page.locator('.checkout-form button[type="submit"]').click()
    await page.waitForFunction(() => document.querySelector(".checkout-form .auth-status")?.textContent.length > 0)
    check((await status.innerText()).includes(locale === "ar" ? "لم يعد متاحًا" : "no longer available") && (await status.innerText()).includes("Plain Fixture"), tag + " unavailable product named and blocked")
    unavailable = false
    await page.route("**/api/orders", (route) => route.fulfill({ status: 429, json: { ok: false, error: "rate_limited" } }))
    await page.locator('.checkout-form button[type="submit"]').click()
    await page.waitForFunction((text) => document.querySelector(".checkout-form .auth-status")?.textContent.includes(text), locale === "ar" ? "محاولات طلب كثيرة" : "Too many order attempts")
    check(await page.locator(".checkout-confirmation").count() === 0, tag + " rate limit message, no confirmation")
    await page.close()
  }
  check(!JSON.stringify(serverLogs).includes("Test Street") && !JSON.stringify(serverLogs).includes("test@example.com"), "server logs carry no address or email")
  console.log(`${checks} browser checks passed; ${messages.length} mock emails; no live writes`)
} finally {
  await browser.close(); await new Promise((resolve) => server.close(resolve)); await db.close()
}
