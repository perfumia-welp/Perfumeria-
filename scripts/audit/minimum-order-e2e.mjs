// Minimum order (shared/orderRules.json): bag -> checkout guard -> /api/orders.
// Isolated like orders-e2e.mjs: browser -> Express -> verifier -> real SQL
// migrations (PGlite) with a fake mail transport. The only network read is a
// GET of live product 14113 from Welp, so its option prices are current.
// Needs `vite build` first. Run: node scripts/audit/minimum-order-e2e.mjs
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { createApp } from "../../server/app.mjs"
import { fetchProduct, verifyOrder, MINIMUM_ORDER_SUBTOTAL } from "../../server/orders.mjs"
import { launch, signInPreview, createAccountData, supabaseRef } from "./lib.mjs"

const SHOTS = process.env.MINIMUM_ORDER_SHOTS
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

// Live 14113 (read-only): one required main-price choice, Without box / With box.
const live = await fetchProduct(14113)
const choice = live.variations.find((v) => v.is_main_price)
const WITHOUT = choice.options.find((o) => o.name.includes("بدون")), WITH = choice.options.find((o) => !o.name.includes("بدون"))
const withoutPrice = Number(WITHOUT.price_after_discount), withPrice = Number(WITH.price_after_discount)
console.log(`live 14113: Without box ${withoutPrice} (before ${WITHOUT.price_before_discount}), With box ${withPrice} (before ${WITH.price_before_discount}); list ${live.price_after_discount}/${live.price_before_discount}`)

// Plain products: [id, sale price, before price]. 31 shows a real sale (1,200 -> 599).
const PLAIN = { 31: [599, 1200], 32: [401, null], 33: [999, null], 34: [1000, null], 35: [1001, null] }
const prices = Object.fromEntries(Object.entries(PLAIN).map(([id, [after]]) => [id, after]))
const fixture = (id) => id === 14113 ? structuredClone(live) : { id, name: `Fixture ${id}`, description: "100ml", product_type: 1382,
  price_before_discount: PLAIN[id][1], price_after_discount: prices[id], is_offer: false, is_available: true, is_variation_available: false,
  image: "https://example.test/bottle.webp", variations: [] }
const catalogue = () => [...Object.keys(PLAIN).map(Number), 14113].map(fixture)

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
  mail: { from: "Perfumira Test <from@example.test>", to: "orders@example.test" }, trustProxy: false, log: (message, detail) => serverLogs.push({ message, detail }) })
const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)) })
const base = `http://127.0.0.1:${server.address().port}`
const orderCount = async () => Number((await db.query("select count(*)::int as n from public.orders")).rows[0].n)
const itemCount = async () => Number((await db.query("select count(*)::int as n from public.order_items")).rows[0].n)

let checks = 0
const check = (value, label) => { assert.ok(value, label); checks++; console.log("PASS " + label) }
const strip = (text) => text.replace(/[‎‏]/g, "").replace(/\s+/g, " ").trim()
const fmt = (amount, locale) => new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", { style: "currency", currency: "EGP",
  minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount)
/** The owner's exact copy, with the amounts formatted as the site formats them. */
const expected = (remaining, locale) => strip(locale === "ar"
  ? `الحد الأدنى للطلب هو ${fmt(1000, "ar")} أضف منتجات بقيمة ${fmt(remaining, "ar")} أخرى للمتابعة إلى إتمام الطلب.`
  : `Minimum order is EGP 1,000. Add ${fmt(remaining, "en")} more to continue to checkout.`)
check(MINIMUM_ORDER_SUBTOTAL === 1000, "server minimum is EGP 1,000")
check(strip(expected(401, "ar")) === strip("الحد الأدنى للطلب هو 1,000 ج.م. أضف منتجات بقيمة 401 ج.م. أخرى للمتابعة إلى إتمام الطلب."), "Arabic copy matches the owner's wording")

const browser = await launch()
/** A signed-in page whose saved bag is `lines` ([productId, quantity, optionIds]). */
async function openBag(lines, { locale, width, height = 900 }) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" })
  const errors = []; page.on("pageerror", (e) => errors.push(e.message))
  await signInPreview(page, createAccountData("empty"))
  for (const table of ["product_metadata", "product_gallery", "orders"]) await page.route(`**/rest/v1/${table}**`, (route) => route.fulfill({ json: [] }))
  const cart = lines.map(([product_id, quantity, option_ids = []]) => ({ product_id, option_ids, quantity }))
  await page.route("**/rest/v1/cart_items**", async (route) => {
    const method = route.request().method(); const url = new URL(route.request().url())
    if (method === "DELETE") cart.length = 0
    if (method === "PATCH") {
      const id = url.searchParams.get("product_id")?.replace("eq.", "")
      const options = url.searchParams.get("option_ids")
      const line = cart.find((r) => String(r.product_id) === id && (!options || options.includes(`{${r.option_ids.join(",")}}`)))
      if (line) line.quantity = route.request().postDataJSON().quantity
    }
    return route.fulfill({ json: cart })
  })
  await page.route("https://api.welpstar.com/**", (route) => {
    const url = new URL(route.request().url()); const products = catalogue()
    const json = url.pathname.endsWith("/all-products") ? { data: [{ name: "Women", products }] } : url.pathname.endsWith("/products") ? { count: products.length, results: products } : { data: fixture(Number(url.pathname.split("/").pop())) }
    return route.fulfill({ json, headers: { "access-control-allow-origin": "*" } })
  })
  for (const host of ["https://example.test/**", "https://wsrv.nl/**", "https://*.welpstar.com/media/**"]) await page.route(host, (route) => route.fulfill({ path: "public/images/packshots/velvet-iris.webp", contentType: "image/webp" }))
  const prefix = locale === "ar" ? "/ar" : ""
  return { page, errors, cart, prefix, url: (p) => base + prefix + p }
}
const onCart = (page) => /\/cart$/.test(new URL(page.url()).pathname)
const onCheckout = (page) => /\/checkout$/.test(new URL(page.url()).pathname)
const message = (page) => page.locator(".order-summary__minimum p")
const settle = (page) => page.waitForTimeout(150)
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: false }) }

try {
  // 1. Server bypass: valid signed-in payloads straight to /api/orders.
  const payload = (lines, displayedTotal) => ({ reference: `PF-MIN-${Date.now().toString(36).toUpperCase()}`, locale: "en", currency: "EGP", displayedTotal,
    customer: { fullName: "Test Buyer", phone: "+201001234567", email: "test@example.com" }, delivery: { address: "Test Street", cityArea: "Cairo" },
    lines: lines.map(([welpProductId, unitPrice, quantity, options = []]) => ({ welpProductId, productId: String(welpProductId), name: "x", unitPrice, quantity, options })) })
  const post = (body) => fetch(base + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer preview" }, body: JSON.stringify(body) })
  const withoutPick = [{ variationId: choice.id, optionId: WITHOUT.id, label: "Without box" }]
  const withPick = [{ variationId: choice.id, optionId: WITH.id, label: "With box" }]
  for (const [label, lines, total, verified] of [
    ["EGP 599 sale item", [[31, 599, 1]], 599, 599],
    ["EGP 999", [[33, 999, 1]], 999, 999],
    ["browser claims the before price 1,200 for the 599 item", [[31, 1200, 1]], 1200, 599],
    [`14113 Without box (${withoutPrice})`, [[14113, withoutPrice, 1, withoutPick]], withoutPrice, withoutPrice],
    [`14113 With box (${withPrice})`, [[14113, withPrice, 1, withPick]], withPrice, withPrice],
  ].filter(([, , , v]) => v < 1000)) {
    const [orders, items, mails] = [await orderCount(), await itemCount(), messages.length]
    const response = await post(payload(lines, total))
    const body = await response.json()
    check(response.status === 422 && body.error === "minimum_order_not_met" && body.minimum === 1000 && body.subtotal === verified, `bypass ${label}: 422 minimum_order_not_met, verified subtotal ${verified}`)
    check(await orderCount() === orders && await itemCount() === items, `bypass ${label}: no order or items written (real SQL)`)
    check(messages.length === mails, `bypass ${label}: no email`)
  }
  check(serverLogs.filter((l) => l.detail?.category === "minimum_order").length >= 3, "refusals logged as minimum_order, without customer details")
  for (const [label, lines, total] of [
    ["exactly EGP 1,000 (599 + 401)", [[31, 599, 1], [32, 401, 1]], 1000],
    ["exactly EGP 1,000 (single item)", [[34, 1000, 1]], 1000],
    ["EGP 1,001", [[35, 1001, 1]], 1001],
    [`14113 With box x 2 (${withPrice * 2})`, [[14113, withPrice, 2, withPick]], withPrice * 2],
    [`14113 Without + With box (${withoutPrice + withPrice})`, [[14113, withoutPrice, 1, withoutPick], [14113, withPrice, 1, withPick]], withoutPrice + withPrice],
  ].filter(([, , t]) => t >= 1000)) {
    const [orders, mails] = [await orderCount(), messages.length]
    const response = await post(payload(lines, total))
    const body = await response.json()
    const row = body.ok && (await db.query("select * from public.orders where reference=$1", [body.order.reference])).rows[0]
    check(response.status === 200 && body.ok && Number(row?.subtotal) === total && await orderCount() === orders + 1, `valid ${label}: stored with verified subtotal ${total}`)
    check(messages.length === mails + 1 && messages.at(-1).subject.includes(body.order.reference), `valid ${label}: one company email`)
  }
  // The real catalogue path the server uses in production (live GET, nothing stored).
  const liveVerify = (pick, quantity, price) => verifyOrder(payload([[14113, price, quantity, pick]], price * quantity), { id: uid })
  if (withoutPrice < 1000) await assert.rejects(liveVerify(withoutPick, 1, withoutPrice), (e) => e.code === "minimum_order_not_met" && e.extra.subtotal === withoutPrice).then(() => check(true, `live Welp verify: 14113 Without box x1 (${withoutPrice}) refused`))
  if (withPrice < 1000) await assert.rejects(liveVerify(withPick, 1, withPrice), (e) => e.code === "minimum_order_not_met" && e.extra.subtotal === withPrice).then(() => check(true, `live Welp verify: 14113 With box x1 (${withPrice}) refused`))
  check((await liveVerify(withPick, 2, withPrice)).subtotal === withPrice * 2, `live Welp verify: 14113 With box x2 (${withPrice * 2}) accepted`)

  // 2. Browser: EN/AR, desktop/mobile.
  for (const locale of ["en", "ar"]) for (const width of [1440, 390]) {
    const tag = `${locale}/${width}`
    const v = { locale, width }

    // 599 (sale) cart: no standing warning; Checkout blocked with EGP 401 more.
    let { page, errors, url } = await openBag([[31, 1]], v)
    await page.goto(url("/cart"), { waitUntil: "networkidle" })
    await page.locator(".cart-line").first().waitFor()
    check(await message(page).count() === 0 && strip(await page.locator(".order-summary__minimum").innerText()) === "", `${tag} 599 cart: no warning before Checkout`)
    const alert = page.locator(".order-summary__minimum")
    check(await alert.getAttribute("role") === "alert", `${tag} message region is role=alert`)
    const button = page.locator(".order-summary__checkout")
    // Page coordinates: clicking may scroll the button into view.
    const pageBox = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height } })
    const before = await pageBox(button)
    await shot(page, `${tag.replace("/", "-")}-599-before`)
    await button.click(); await settle(page)
    check(onCart(page), `${tag} 599 cart: Checkout stays on the bag`)
    check(strip(await message(page).innerText()) === expected(401, locale), `${tag} 599 cart: "${strip(await message(page).innerText())}"`)
    check(await button.getAttribute("aria-describedby") === await alert.getAttribute("id"), `${tag} Checkout button described by the message`)
    const after = await pageBox(button)
    check(Math.abs(after.y - before.y) < 1 && Math.abs(after.x - before.x) < 1, `${tag} button does not move when the message appears`)
    const msgBox = await pageBox(message(page)), summary = await pageBox(page.locator(".order-summary"))
    check(msgBox.y >= after.y + after.height && msgBox.x >= summary.x - 1 && msgBox.x + msgBox.width <= summary.x + summary.width + 1, `${tag} message directly under the Checkout button, inside the summary`)
    const side = await message(page).evaluate((el) => { const s = getComputedStyle(el); return { left: s.borderLeftWidth, right: s.borderRightWidth, dir: getComputedStyle(document.documentElement).direction, align: s.textAlign } })
    check(locale === "ar" ? side.dir === "rtl" && side.right === "2px" && side.left === "0px" : side.left === "2px" && side.right === "0px", `${tag} accent rule on the reading-start side (${side.dir})`)
    check(await noOverflow(page), `${tag} no horizontal overflow with the message`)
    await page.waitForTimeout(400)
    // On screen and not under the fixed "Need help?" launcher or WhatsApp button.
    const covered = await message(page).evaluate((el) => {
      const r = el.getBoundingClientRect()
      if (r.top < 0 || r.bottom > innerHeight) return "off screen"
      for (const x of [r.left + 4, (r.left + r.right) / 2, r.right - 4]) for (const y of [r.top + 4, r.bottom - 4]) {
        const hit = document.elementFromPoint(x, y)
        if (!el.contains(hit)) return `covered by ${hit?.className}`
      }
      return ""
    })
    check(covered === "", `${tag} message is fully on screen and uncovered after the attempt ${covered}`)
    await shot(page, `${tag.replace("/", "-")}-599-after`)

    // Quantity 1 -> 2 (1,198): message clears and Checkout works.
    await page.locator(".quantity-control button").last().click()
    await page.waitForFunction(() => !document.querySelector(".order-summary__minimum p"))
    check(await message(page).count() === 0, `${tag} quantity to 2 (1,198) clears the message`)
    await button.click()
    await page.waitForURL(/\/checkout$/)
    check(onCheckout(page), `${tag} quantity 2: Checkout opens`)
    check(errors.length === 0, `${tag} no uncaught errors (599 flow)`)
    await page.close()

    // 401 cart: the remaining amount follows quantity changes while shown.
    ;({ page, errors, url } = await openBag([[32, 1]], v))
    await page.goto(url("/cart"), { waitUntil: "networkidle" })
    await page.locator(".order-summary__checkout").click(); await settle(page)
    check(strip(await message(page).innerText()) === expected(599, locale), `${tag} 401 cart: EGP 599 more`)
    await page.locator(".quantity-control button").last().click()
    await page.waitForFunction((text) => document.querySelector(".order-summary__minimum p")?.textContent.replace(/[‎‏]/g, "").includes(text), fmt(198, locale).replace(/[‎‏]/g, ""))
    check(strip(await message(page).innerText()) === expected(198, locale), `${tag} quantity 2 (802): message updates to EGP 198 without a new click`)
    // Quantity 3: 1,203 before, but Buy 3 — Cheapest Item Free makes one unit
    // free, so the customer pays 802 and is still EGP 198 short.
    await page.locator(".quantity-control button").last().click()
    await page.locator(".order-summary__promotion").waitFor()
    await page.waitForTimeout(300)
    check(strip(await message(page).innerText()) === expected(198, locale), `${tag} quantity 3 (1,203 - 401 = 802): still EGP 198 short after the promotion`)
    // Quantity 4: 1,604 - 401 = 1,203 clears it.
    await page.locator(".quantity-control button").last().click()
    await page.waitForFunction(() => !document.querySelector(".order-summary__minimum p"))
    await page.locator(".quantity-control button").first().click()
    await page.waitForTimeout(400)
    check(await message(page).count() === 0, `${tag} back below the minimum: no message until the next attempt`)
    await page.close()

    // 999 / 1,000 / 1,001 / 599 + 401.
    for (const [label, lines, remaining] of [["999", [[33, 1]], 1], ["1,000", [[34, 1]], 0], ["1,001", [[35, 1]], 0], ["599 + 401", [[31, 1], [32, 1]], 0]]) {
      ;({ page, errors, url } = await openBag(lines, v))
      await page.goto(url("/cart"), { waitUntil: "networkidle" })
      await page.locator(".order-summary__checkout").click()
      if (remaining) {
        await settle(page)
        check(onCart(page) && strip(await message(page).innerText()) === expected(remaining, locale), `${tag} ${label} cart: blocked, EGP ${remaining} more`)
      } else {
        await page.waitForURL(/\/checkout$/)
        await page.locator(".checkout-form").waitFor({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(500)
        if (!onCheckout(page)) console.log("DIAGNOSTIC", page.url(), await page.locator("main").innerText().catch(() => ""))
        check(onCheckout(page) && await page.locator(".checkout-form").count() === 1, `${tag} ${label} cart: Checkout allowed (form shown, no redirect back)`)
      }
      await page.close()
    }

    // Live 14113 option prices.
    for (const [label, lines, total] of [
      [`14113 Without box (${withoutPrice})`, [[14113, 1, [WITHOUT.id]]], withoutPrice],
      [`14113 With box (${withPrice})`, [[14113, 1, [WITH.id]]], withPrice],
      [`14113 With box x2 (${withPrice * 2})`, [[14113, 2, [WITH.id]]], withPrice * 2],
    ]) {
      ;({ page, errors, url } = await openBag(lines, v))
      await page.goto(url("/cart"), { waitUntil: "networkidle" })
      await page.locator(".cart-line").first().waitFor()
      await page.locator(".order-summary__checkout").click()
      if (total < 1000) {
        await settle(page)
        check(onCart(page) && strip(await message(page).innerText()) === expected(1000 - total, locale), `${tag} ${label}: blocked, EGP ${1000 - total} more (option sale price)`)
      } else {
        await page.waitForURL(/\/checkout$/)
        check(onCheckout(page), `${tag} ${label}: Checkout allowed`)
      }
      await page.close()
    }

    // Direct /checkout below the minimum: back to the bag with the message.
    ;({ page, errors, url } = await openBag([[33, 1]], v))
    await page.goto(url("/checkout"), { waitUntil: "networkidle" })
    await page.waitForURL(/\/cart$/)
    await message(page).waitFor()
    check(onCart(page) && await page.locator(".checkout-form").count() === 0, `${tag} direct /checkout at 999 redirects to the bag`)
    check(strip(await message(page).innerText()) === expected(1, locale), `${tag} redirected bag shows the minimum message`)
    check(errors.length === 0, `${tag} no uncaught errors (direct checkout)`)
    await page.close()

    // Keyboard: Enter and Space on Checkout.
    ;({ page, errors, url } = await openBag([[31, 1]], v))
    await page.goto(url("/cart"), { waitUntil: "networkidle" })
    await page.locator(".order-summary__checkout").focus()
    await page.keyboard.press("Enter"); await settle(page)
    check(onCart(page) && strip(await message(page).innerText()) === expected(401, locale), `${tag} keyboard Enter: blocked with the message`)
    check(await page.evaluate(() => document.activeElement?.classList.contains("order-summary__checkout")), `${tag} keyboard focus stays on Checkout`)
    const firstNode = await message(page).elementHandle()
    await page.keyboard.press("Space"); await settle(page)
    check(await message(page).evaluate((el, old) => el !== old, firstNode), `${tag} keyboard Space: repeat attempt re-announces (new alert node)`)
    await page.close()

    // Mobile sticky bar: the attempt scrolls the message into view.
    if (width === 390) {
      ;({ page, errors, url } = await openBag([[31, 1]], { ...v, height: 560 }))
      await page.goto(url("/cart"), { waitUntil: "networkidle" })
      await page.locator(".cart-line").first().waitFor()
      await page.evaluate(() => scrollTo(0, 0)); await settle(page)
      const bar = page.locator(".mobile-checkout:not(.is-hidden) .mobile-checkout__bar button")
      if (await bar.count()) {
        await bar.click(); await page.waitForTimeout(300)
        const box = await message(page).boundingBox()
        check(onCart(page) && strip(await message(page).innerText()) === expected(401, locale), `${tag} mobile bar Checkout: blocked with the message`)
        check(box && box.y >= 0 && box.y + box.height <= 560, `${tag} mobile bar: message scrolled into view`)
        check(await page.evaluate(() => document.activeElement?.classList.contains("order-summary__checkout")), `${tag} mobile bar: focus moves to the summary Checkout`)
        await shot(page, `${tag.replace("/", "-")}-mobile-bar`)
      } else console.log(`NOTE ${tag} mobile bar hidden at this height (summary already visible)`)
      check(await noOverflow(page), `${tag} mobile: no horizontal overflow`)
      await page.close()
    }

    // Through the real UI: an order at exactly EGP 1,000 is stored; a price
    // drop after reaching checkout is refused by the server with the message.
    ;({ page, errors, url } = await openBag([[34, 1]], v))
    await page.goto(url("/cart"), { waitUntil: "networkidle" })
    await page.locator(".order-summary__checkout").click()
    await page.waitForURL(/\/checkout$/)
    for (const [key, value] of Object.entries({ fullName: "Test Buyer", phone: "+201001234567", email: "test@example.com", address: "Test Street", cityArea: "Cairo" })) await page.locator(`.checkout-form [name=${key}]`).fill(value)
    prices[34] = 950
    const [orders, mails] = [await orderCount(), messages.length]
    await page.locator('.checkout-form button[type="submit"]').click()
    await page.waitForFunction(() => document.querySelector(".checkout-form .auth-status")?.textContent.length > 0)
    check(strip(await page.locator(".checkout-form .auth-status").innerText()) === expected(50, locale) && await page.locator(".checkout-confirmation").count() === 0, `${tag} server refusal after a price drop shows the message (EGP 50 more)`)
    check(await orderCount() === orders && messages.length === mails, `${tag} price-drop refusal: nothing stored, no email`)
    await shot(page, `${tag.replace("/", "-")}-server-refusal`)
    prices[34] = 1000
    await page.locator('.checkout-form button[type="submit"]').click()
    await page.locator(".checkout-confirmation").waitFor()
    check(await orderCount() === orders + 1 && messages.length === mails + 1, `${tag} EGP 1,000 order submitted through the UI: stored + one email`)
    check(await noOverflow(page) && errors.length === 0, `${tag} checkout: no overflow, no uncaught errors`)
    await page.close()
  }
  const logText = JSON.stringify(serverLogs)
  check(!logText.includes("Test Street") && !logText.includes("test@example.com"), "server logs carry no address or email")
  console.log(`${checks} checks passed; ${messages.length} mock emails; ${await orderCount()} orders in the in-memory database; no live writes`)
} finally {
  await browser.close(); await new Promise((resolve) => server.close(resolve)); await db.close()
}
