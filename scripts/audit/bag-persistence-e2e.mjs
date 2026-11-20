// Add to Bag survives a full page load that cancels the save (2026-11-20).
// Browser -> real createApp over dist/ -> stubbed Supabase auth + cart_items
// with controllable latency. Two kinds of interrupted save are simulated:
//  - "lost":   the write never reaches the database (cancelled in flight),
//  - "landed": the write is stored but the page never sees the answer.
// After a hard refresh / typed URL the bag must hold exactly what was shown:
// nothing lost, nothing applied twice. Guests (with and without a guest
// identity yet) and signed-in customers; EN/AR; desktop/mobile.
// usage: node scripts/audit/bag-persistence-e2e.mjs   (after vite build)
import assert from "node:assert/strict"
import path from "node:path"
import { createApp } from "../../server/app.mjs"
import { launch, signInPreview, createAccountData, supabaseRef } from "./lib.mjs"

const fixture = (id) => ({ id, name: `Plain Fixture ${id}`, description: "100ml", product_type: 1344,
  price_after_discount: 1100, is_available: true, is_variation_available: false,
  image: "https://example.test/bottle.webp", variations: [] })
const IDS = [19, 23, 25]
const app = createApp({ distDir: path.resolve(process.env.DIST_DIR || "dist"), supabaseUrl: `https://${supabaseRef()}.supabase.co`,
  orderStore: { authenticate: async () => null, arabicNames: async () => new Map(), save: async () => null, claimNotification: async () => null, finishNotification: async () => null },
  getProduct: async (id) => fixture(id), transport: { sendMail: async () => {} }, mail: { from: "t@example.test", to: "o@example.test" }, trustProxy: false, log: () => {} })
const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)) })
const base = `http://127.0.0.1:${server.address().port}`
const browser = await launch()
let checks = 0
const failures = []
const check = (value, label) => { checks++; if (value) console.log("PASS " + label); else { failures.push(label); console.log("FAIL " + label) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function eventually(fn, ms = 8000) {
  const end = Date.now() + ms
  for (;;) { const v = await fn(); if (v || Date.now() > end) return v; await sleep(100) }
}

/** One isolated browser context with its own stub database. */
async function setup({ locale, width, who }) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" })
  const page = await context.newPage()
  const errors = []; page.on("pageerror", (e) => errors.push(e.message))
  const db = { rows: new Map(), mode: "fast", delay: 1200, signupDelay: 0, writes: 0, signups: 0 }
  const cartOf = (route) => {
    const token = (route.request().headers().authorization ?? "").replace(/^Bearer /, "")
    if (!db.rows.has(token)) db.rows.set(token, [])
    return db.rows.get(token)
  }
  if (who === "customer") await signInPreview(page, createAccountData("empty"))
  else {
    await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }))
    await page.route("**/auth/v1/**", (route) => route.fulfill({ json: {} }))
    await page.route("**/auth/v1/signup", async (route) => {
      db.signups++
      if (db.signupDelay) await sleep(db.signupDelay)
      const now = Math.floor(Date.now() / 1000)
      await route.fulfill({ json: { access_token: "guest-token", refresh_token: "guest-refresh", token_type: "bearer", expires_in: 3600, expires_at: now + 3600,
        user: { id: "00000000-0000-0000-0000-0000000000a1", aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } } }).catch(() => {})
    })
  }
  for (const table of ["product_metadata", "product_gallery", "orders"]) await page.route(`**/rest/v1/${table}**`, (route) => route.fulfill({ json: [] }))
  // Main-frame document loads, so a "lost" write knows its page went away.
  let documents = 0
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) documents++ })
  /** Runs a write according to db.mode; "lost" never stores it when the page went away first. */
  const write = async (route, apply, answer) => {
    db.writes++
    if (db.mode === "fast") { apply(); return route.fulfill({ json: answer() }) }
    if (db.mode === "landed") { apply(); await sleep(db.delay); return route.fulfill({ json: answer() }).catch(() => {}) }
    const loadedIn = documents
    await sleep(db.delay)
    if (documents !== loadedIn) { db.lost = (db.lost ?? 0) + 1; return route.abort().catch(() => {}) }
    apply()
    return route.fulfill({ json: answer() }).catch(() => {})
  }
  await page.route("**/rest/v1/cart_items**", async (route) => {
    const cart = cartOf(route); const method = route.request().method(); const url = new URL(route.request().url())
    const productId = Number(url.searchParams.get("product_id")?.replace("eq.", ""))
    if (method === "GET") return route.fulfill({ json: cart.map((r) => ({ ...r })) })
    if (method === "DELETE") return write(route, () => {
      const before = cart.map((r) => ({ ...r }))
      const keep = productId ? cart.filter((r) => r.product_id !== productId) : []
      cart.splice(0, cart.length, ...keep)
      return () => cart.splice(0, cart.length, ...before)
    }, () => [])
    if (method === "PATCH") return write(route, () => {
      const line = cart.find((r) => r.product_id === productId); const was = line?.quantity
      if (line) line.quantity = route.request().postDataJSON().quantity
      return () => { if (line) line.quantity = was }
    }, () => [])
    return route.fulfill({ json: [] })
  })
  await page.route("**/rest/v1/rpc/add_cart_item", async (route) => {
    const cart = cartOf(route); const body = route.request().postDataJSON(); let line
    return write(route, () => {
      line = cart.find((r) => r.product_id === body.p_product_id && JSON.stringify(r.option_ids) === JSON.stringify(body.p_option_ids))
      if (line) { const was = line.quantity; line.quantity = Math.min(10, line.quantity + body.p_quantity); const l = line; return () => { l.quantity = was } }
      line = { product_id: body.p_product_id, option_ids: body.p_option_ids, quantity: body.p_quantity }; cart.push(line)
      const l = line; return () => cart.splice(cart.indexOf(l), 1)
    }, () => ({ ...line }))
  })
  await page.route("https://api.welpstar.com/**", (route) => {
    const url = new URL(route.request().url()); const products = IDS.map(fixture)
    const json = url.pathname.endsWith("/all-products") ? { data: [{ name: "Women", products }] } : url.pathname.endsWith("/products") ? { count: products.length, results: products } : { data: fixture(Number(url.pathname.split("/").pop())) }
    return route.fulfill({ json, headers: { "access-control-allow-origin": "*" } })
  })
  await page.route("https://example.test/**", (route) => route.fulfill({ path: "public/images/packshots/velvet-iris.webp", contentType: "image/webp" }))
  await page.route("https://wsrv.nl/**", (route) => route.fulfill({ path: "public/images/packshots/velvet-iris.webp", contentType: "image/webp" }))
  const prefix = locale === "ar" ? "/ar" : ""
  const token = who === "customer" ? "preview" : "guest-token"
  const server = () => (db.rows.get(token) ?? []).map((r) => `${r.product_id}x${r.quantity}`).sort().join(",")
  const badge = () => page.evaluate(() => document.querySelector('.header-actions a[href$="/cart"] .icon-button__badge')?.textContent ?? "")
  const digits = (s) => s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
  /** Waits until the shown bag and the stub database both hold `expected` (e.g. "19x1,23x2"). */
  const settled = async (expected) => {
    const total = expected ? expected.split(",").reduce((n, l) => n + Number(l.split("x")[1]), 0) : 0
    const ok = await eventually(async () => server() === expected && digits(await badge()) === String(total), 10000)
    return ok || `server=${server()} badge=${await badge()} expected=${expected}`
  }
  const pdp = (id) => page.goto(`${base}${prefix}/products/product-${id}`, { waitUntil: "networkidle" })
  const addOnPdp = async (id, times = 1) => {
    await pdp(id)
    const add = page.locator(".pdp__add").first(); await add.waitFor()
    for (let i = 0; i < times; i++) await add.click()
  }
  /** Gives the guest an identity first (the bag starts it on the first add). */
  const ensureGuest = async () => {
    if (who !== "guest") return
    await addOnPdp(IDS[2]); await settled("25x1")
    await page.goto(`${base}${prefix}/cart`, { waitUntil: "networkidle" })
    await page.locator(`.cart-line[data-product-id="25"] .cart-line__remove`).click()
    await settled("")
  }
  return { context, page, db, errors, prefix, server, badge, settled, pdp, addOnPdp, ensureGuest }
}

const timings = []
try {
  for (const locale of ["en", "ar"]) for (const width of [1440, 390]) {
    const tag = (t) => `${locale}/${width}/${t}`

    // 1. A visitor with no guest identity yet: Add to Bag, then hard refresh
    //    while the anonymous sign-in itself is still on its way.
    {
      const s = await setup({ locale, width, who: "visitor" })
      s.db.signupDelay = 1500
      await s.addOnPdp(19)
      const t0 = Date.now(); await eventually(async () => (await s.badge()) !== "" && (await s.badge()) !== "0", 3000); timings.push(Date.now() - t0)
      await s.page.reload({ waitUntil: "commit" })
      s.db.signupDelay = 0
      check((await s.settled("19x1")) === true, tag("visitor: refresh before guest identity keeps the item, saved once"))
      await s.page.goto(`${base}${s.prefix}/cart`, { waitUntil: "networkidle" })
      check(await s.page.locator(".cart-line").count() === 1, tag("visitor: bag page shows the line"))
      check(s.errors.length === 0, tag("visitor: no uncaught errors") + " " + s.errors.join("|"))
      await s.context.close()
    }

    // 1b. Two adds, refresh, then a typed URL straight away: the second load
    //     cancels the restored page's guest sign-in (seen on the review server).
    {
      const s = await setup({ locale, width, who: "visitor" })
      s.db.signupDelay = 600
      await s.addOnPdp(19, 2)
      await s.page.reload({ waitUntil: "commit" })
      await s.page.waitForTimeout(250)
      await s.page.goto(`${base}${s.prefix}/cart`, { waitUntil: "commit" })
      s.db.signupDelay = 0
      const r = await s.settled("19x2")
      check(r === true, tag("visitor: refresh + typed URL during guest sign-in keeps 19x2 ") + (r === true ? "" : r))
      await s.context.close()
    }

    for (const who of ["guest", "customer"]) {
      // 2. Hard refresh right after Add to Bag: write cancelled, and write stored but unanswered.
      for (const mode of ["lost", "landed"]) {
        const s = await setup({ locale, width, who })
        await s.ensureGuest()
        s.db.mode = mode
        const writesBefore = s.db.writes
        await s.addOnPdp(19)
        // Refresh only once the write is on the network (the in-flight case).
        check(await eventually(() => s.db.writes > writesBefore, 5000), tag(`${who}/${mode}: write in flight before the refresh`))
        await s.page.reload({ waitUntil: "commit" })
        s.db.mode = "fast"
        const r = await s.settled("19x1")
        check(r === true, tag(`${who}: refresh while the save is ${mode} -> 19x1 `) + (r === true ? "" : r))
        if (mode === "lost") check(await eventually(() => s.db.lost > 0, 5000), tag(`${who}: the interrupted write really was dropped (${s.db.lost})`))
        // A second refresh changes nothing (journal gone or idempotent).
        await s.page.reload({ waitUntil: "networkidle" })
        check((await s.settled("19x1")) === true, tag(`${who}/${mode}: second refresh, no duplicate`))
        check(s.errors.length === 0, tag(`${who}/${mode}: no uncaught errors`) + " " + s.errors.join("|"))
        await s.context.close()
      }

      // 3. Typed URL right after Add to Bag (lost write), onto another page.
      {
        const s = await setup({ locale, width, who })
        await s.ensureGuest()
        s.db.mode = "lost"
        await s.addOnPdp(23)
        await s.page.goto(`${base}${s.prefix}/cart`, { waitUntil: "commit" })
        s.db.mode = "fast"
        check((await s.settled("23x1")) === true, tag(`${who}: typed URL right after add keeps the item`))
        await s.page.locator(".cart-line").first().waitFor({ timeout: 10000 }).catch(() => {})
        check(await s.page.locator(".cart-line").count() === 1, tag(`${who}: typed URL lands on a bag with the line`))
        await s.context.close()
      }

      // 4. Several quick adds (same product x3, then two more products via
      //    client-side links), refresh while the last saves are in flight.
      {
        const s = await setup({ locale, width, who })
        await s.ensureGuest()
        s.db.mode = "landed"; s.db.delay = 700
        await s.addOnPdp(19, 3)
        await s.page.goto(`${base}${s.prefix}/products`, { waitUntil: "networkidle" })
        for (const id of [23, 25]) await s.page.locator(`button.product-card__add[aria-label*="${id}"], button.dossier-card__add[aria-label*="${id}"]`).first().click()
        await s.page.reload({ waitUntil: "commit" })
        s.db.mode = "fast"
        const r = await s.settled("19x3,23x1,25x1")
        check(r === true, tag(`${who}: quick adds + refresh -> 19x3,23x1,25x1 `) + (r === true ? "" : r))
        await s.context.close()
      }

      // 5. Normal client-side navigation: nothing changes for the shopper.
      {
        const s = await setup({ locale, width, who })
        await s.ensureGuest()
        await s.addOnPdp(19)
        await s.page.locator('.header-actions a[href$="/cart"]').click()
        await s.page.locator(".cart-line").first().waitFor()
        check((await s.settled("19x1")) === true, tag(`${who}: client-side navigation saves normally`))
        // Remove, then refresh at once (lost write): stays removed.
        s.db.mode = "lost"
        await s.page.locator(".cart-line__remove").first().click()
        await s.page.reload({ waitUntil: "commit" })
        s.db.mode = "fast"
        check((await s.settled("")) === true, tag(`${who}: remove + immediate refresh stays removed`))
        // The stub database changes before the page reads the answer, so poll.
        const journalKeys = () => s.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("perfumira:bag-sync:")))
        await eventually(async () => (await journalKeys()).length === 0, 5000)
        const keys = await journalKeys()
        check(keys.length === 0, tag(`${who}: journal removed once everything is saved`) + " " + keys.join(","))
        check(s.errors.length === 0, tag(`${who}: no uncaught errors (navigation)`) + " " + s.errors.join("|"))
        await s.context.close()
      }
    }
  }
  timings.sort((a, b) => a - b)
  console.log("click->badge (ms, visitor first add, includes 100 ms poll):", timings.join(","))
} finally {
  await browser.close(); server.close()
}
console.log(`\n${checks - failures.length}/${checks} checks passed`)
if (failures.length) { console.log("FAILURES:\n" + failures.join("\n")); process.exit(1) }
