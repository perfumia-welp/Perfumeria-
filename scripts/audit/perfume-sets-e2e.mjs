// Perfume Set display names: live catalogue -> card -> product page -> bag ->
// checkout -> /api/orders (real verifier, live read-only Welp GETs) -> PGlite
// order (real migrations) -> fake email -> account history. Nothing reaches
// the real Supabase or SMTP. Needs `vite build` first.
// Run from the repo root: node scripts/audit/perfume-sets-e2e.mjs
// (PERFUME_SETS_SHOTS=<dir> saves screenshots.)
import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { createApp } from "../../server/app.mjs"
import { fetchProduct } from "../../server/orders.mjs"
import { createOrderRules } from "../../server/orderRules.mjs"
import { launch, signInPreview, createAccountData, supabaseRef } from "./lib.mjs"

const OUT = process.env.PERFUME_SETS_SHOTS
if (OUT) fs.mkdirSync(OUT, { recursive: true })

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
for (const file of fs.readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort())
  await db.exec(fs.readFileSync(path.join("supabase/migrations", file), "utf8"))
const uid = "00000000-0000-0000-0000-000000000001"
await db.query("insert into auth.users(id,email,is_anonymous) values ($1,'test@example.com',false)", [uid])
const asService = (sql, params) => db.transaction(async (tx) => {
  await tx.exec("set local role service_role")
  return (await tx.query(sql, params)).rows[0]
})
const store = {
  authenticate: async (token) => (token === "preview" ? { id: uid } : null),
  arabicNames: async () => new Map(),
  save: async (order, owner, fingerprint) => (await asService("select public.store_verified_order($1::jsonb) as saved", [JSON.stringify({ owner, fingerprint, snapshot: order })])).saved,
  claimNotification: async (id) => (await asService("select public.claim_order_notification($1) as claim", [id])).claim,
  finishNotification: async (id, claim, outcome) => (await asService("select public.finish_order_notification($1, $2, $3) as done", [id, claim, outcome])).done,
}
const messages = []
const app = createApp({
  orderRules: createOrderRules({ fetchMinimum: async () => 1000 }),
  distDir: path.resolve("dist"), supabaseUrl: `https://${supabaseRef()}.supabase.co`, orderStore: store,
  getProduct: fetchProduct, orderLimit: { windowMs: 60000, limit: 1000 },
  transport: { sendMail: async (mail) => { messages.push(mail) } },
  mail: { from: "Perfumira Test <from@example.test>", to: "sales@example.test" }, trustProxy: false, log: () => {},
})
const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)) })
const base = `http://127.0.0.1:${server.address().port}`

// Same columns as services/account.ts ORDER_COLUMNS, including lines:verified_snapshot->lines.
const historyRows = async () => (await db.query(`
  select o.id, o.reference, o.created_at, o.status, o.subtotal,
         o.verified_snapshot -> 'displayedTotal' as total, o.verified_snapshot -> 'promotion' as promotion,
         o.verified_snapshot -> 'lines' as lines, o.currency,
         coalesce((select json_agg(json_build_object('position', i.position, 'product_ref', i.product_ref, 'product_name', i.product_name,
           'product_name_ar', i.product_name_ar, 'size', i.size, 'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total,
           'image_url', i.image_url) order by i.position) from public.order_items i where i.order_id = o.id), '[]') as order_items
    from public.orders o where o.user_id = $1 order by o.created_at desc`, [uid])).rows

const results = []
const check = (ok, label, detail = "") => { results.push({ ok, label, detail }); console.log((ok ? "PASS " : "FAIL ") + label + (ok || !detail ? "" : " :: " + detail)) }
const strip = (t) => t.replace(/[‎‏⁦-⁩]/g, "").replace(/[\s ]+/g, " ").trim()

const browser = await launch()
const cart = [{ product_id: 14133, option_ids: [], quantity: 1 }, { product_id: 14128, option_ids: [], quantity: 1 }]
async function open(locale, width = 1280, height = 900) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" })
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await signInPreview(page, createAccountData("empty"))
  for (const table of ["product_metadata", "product_gallery"]) await page.route(`**/rest/v1/${table}**`, (route) => route.fulfill({ json: [] }))
  await page.route("**/rest/v1/orders**", async (route) => route.fulfill({ json: await historyRows() }))
  await page.route("**/rest/v1/cart_items**", async (route) => route.fulfill({ json: cart }))
  return { page, errors, url: (p) => base + (locale === "ar" ? "/ar" : "") + p }
}
const shot = async (page, name, opts = {}) => { if (OUT) await page.screenshot({ path: path.join(OUT, name + ".png"), ...opts }) }
const cardOf = (page, id) => page.locator(`a[href$="/products/product-${id}"]`).first().locator("xpath=ancestor-or-self::*[self::article or self::li][1]")
const cardNames = (page) => page.locator("main h2, main h3").filter({ hasNot: page.locator("xpath=ancestor::header") }).allInnerTexts()

const SETS = {
  14121: "Billie Eilish Eau de Parfum Set", 14122: "Rasasi Hawas Perfume Set for Him", 14123: "Rasasi Hawas Perfume Set for Him",
  14124: "ASSAF Luxury Perfume Set", 14126: "Louis Vuitton Perfume Set", 14128: "Laverne Perfume Set",
  14132: "Kayali Miniature Perfume Set", 14133: "Yves Saint Laurent Perfume Set",
}

for (const locale of ["en", "ar"]) {
  const tag = `[${locale}]`
  const { page, errors, url } = await open(locale)

  // Category: same 16 products, normalized names on cards.
  await page.goto(url("/products?type=gift-sets&page=2"), { waitUntil: "networkidle" })
  await page.locator(`a[href$="/products/product-14133"]`).first().waitFor({ timeout: 30000 })
  const links = await page.locator('main a[href*="/products/product-"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href").match(/product-(\d+)/)[1]))])
  const total = strip(await page.locator("main").innerText()).match(/(\d+)\s*(products|منتج)/)?.[0]
  check(links.length === 16, `${tag} /products?type=gift-sets lists 16 products`, `${links.length} ${links.join(",")} (${total})`)
  const text = strip(await page.locator("main").innerText())
  for (const [id, name] of Object.entries(SETS)) check(text.includes(name), `${tag} card shows "${name}" (${id})`)
  check(!/gift set/i.test(text) && !/\bGift\b/.test(text), `${tag} no "Gift Set" / "Gift" left on the Perfume Boxes listing`)
  await cardOf(page, 14133).scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  if (locale === "en") await shot(page, "after-card-14133", { clip: await cardOf(page, 14133).boundingBox() })

  // Product page: old URL still works, name + description normalized.
  await page.goto(url("/products/product-14133"), { waitUntil: "networkidle" })
  await page.locator("h1").waitFor()
  const h1 = strip(await page.locator("h1").innerText())
  check(h1 === "Yves Saint Laurent Perfume Set", `${tag} /products/product-14133 opens; h1 = Perfume Set`, h1)
  const main = strip(await page.locator("main").innerText())
  check(main.includes("Yves Saint Laurent Perfume Set – 4 × 30ml") && !/gift set/i.test(main), `${tag} product description says Perfume Set, never gift set`)
  check(/gift box/i.test(main), `${tag} product description keeps "gift box" (packaging)`)
  const title = await page.title()
  check(title.includes("Yves Saint Laurent Perfume Set"), `${tag} page title uses the Perfume Set name`, title)
  await page.waitForTimeout(800)
  await shot(page, `${locale}-product-14133`)

  // Search: original wording still finds the sets; new wording finds every set
  // whose displayed name says "Perfume Set". 14121 is displayed as "Billie
  // Eilish Eau de Parfum Set" (no "Perfume Set"), so it is searched by its own name.
  const perfumeSetIds = Object.entries(SETS).filter(([, name]) => /perfume set/i.test(name)).map(([id]) => Number(id))
  for (const [q, expect] of [["gift set", [14122, 14123, 14126, 14128, 14132, 14133]], ["perfume set", perfumeSetIds], ["eau de parfum set", [14121]], ["laverne gift", [14128]]]) {
    await page.goto(url(`/products?q=${encodeURIComponent(q)}&page=3`), { waitUntil: "networkidle" })
    await page.waitForTimeout(500)
    const found = await page.locator('main a[href*="/products/product-"]').evaluateAll((as) => [...new Set(as.map((a) => Number(a.getAttribute("href").match(/product-(\d+)/)[1])))])
    const ok = expect.every((id) => found.includes(id))
    check(ok, `${tag} search "${q}" finds ${expect.join(",")}`, `found ${found.join(",")}`)
    if (q === "gift set") console.log(`${tag} search "gift set" -> ${found.sort().join(",")}`)
  }

  // Bag.
  await page.goto(url("/cart"), { waitUntil: "networkidle" })
  await page.locator('.cart-line[data-product-id="14133"]').waitFor({ timeout: 30000 })
  const bag = strip(await page.locator("main").innerText())
  check(bag.includes("Yves Saint Laurent Perfume Set") && bag.includes("Laverne Perfume Set") && !/gift set/i.test(bag), `${tag} bag shows Perfume Set names`)
  await page.waitForTimeout(600)
  await shot(page, `${locale}-bag`, { fullPage: true })

  // Checkout -> order -> confirmation.
  await page.locator(".order-summary__checkout").click()
  await page.waitForURL(/\/checkout$/)
  await page.locator(".checkout-form").waitFor()
  const co = strip(await page.locator(".checkout-summary").innerText())
  check(co.includes("Yves Saint Laurent Perfume Set") && co.includes("Laverne Perfume Set") && !/gift set/i.test(co), `${tag} checkout summary shows Perfume Set names`)
  for (const [key, value] of Object.entries({ fullName: "Test Buyer", phone: "+201001234567", email: "test@example.com", address: "Test Street 1", cityArea: "Cairo" }))
    await page.locator(`.checkout-form [name=${key}]`).fill(value)
  await page.waitForTimeout(400)
  await shot(page, `${locale}-checkout`, { fullPage: true })
  const before = messages.length
  await page.locator('.checkout-form button[type="submit"]').click()
  await page.locator(".checkout-confirmation").waitFor({ timeout: 60000 })
  const conf = strip(await page.locator("main").innerText())
  check(conf.includes("Yves Saint Laurent Perfume Set") && conf.includes("Laverne Perfume Set") && !/gift set/i.test(conf), `${tag} order confirmation shows Perfume Set names`)
  await page.waitForTimeout(400)
  await shot(page, `${locale}-confirmation`, { fullPage: true })

  // Stored record + email.
  const row = (await db.query("select verified_snapshot from public.orders order by created_at desc limit 1")).rows[0].verified_snapshot
  const items = (await db.query("select product_name, product_name_ar from public.order_items i join public.orders o on o.id = i.order_id order by o.created_at desc, i.position limit 2")).rows
  check(row.lines[0].name === "Yves Saint Laurent Gift Set" && row.lines[1].name === "Laverne Gift Set", `${tag} stored snapshot keeps the Welp names as the record`, JSON.stringify(row.lines.map((l) => l.name)))
  check(row.lines[0].displayName === "Yves Saint Laurent Perfume Set" && row.lines[1].displayName === "Laverne Perfume Set", `${tag} stored snapshot has the display names`)
  check(items[0].product_name === "Yves Saint Laurent Gift Set" && items[0].product_name_ar === "Yves Saint Laurent Perfume Set", `${tag} order_items: product_name = Welp, product_name_ar = display`, JSON.stringify(items))
  check(messages.length === before + 1, `${tag} one company email`)
  const mail = messages.at(-1).text
  check(mail.includes("14133 | Yves Saint Laurent Perfume Set | 1 x 899 EGP") && mail.includes("   Catalogue name: Yves Saint Laurent Gift Set") && mail.indexOf("Yves Saint Laurent Perfume Set") < mail.indexOf("Yves Saint Laurent Gift Set") && !mail.includes("Shown to the customer as: Yves"), `${tag} email: Perfume Set name leads, catalogue name secondary`)
  if (OUT) fs.writeFileSync(path.join(OUT, `${locale}-email.txt`), `Subject: ${messages.at(-1).subject}\n\n${mail}\n`)

  // History.
  await page.goto(url("/account/orders"), { waitUntil: "networkidle" })
  await page.locator(".order-list__items").first().waitFor({ timeout: 30000 })
  const hist = strip(await page.locator(".order-list__items").first().innerText())
  check(hist.includes("Yves Saint Laurent Perfume Set") && hist.includes("Laverne Perfume Set") && !/gift set/i.test(hist), `${tag} order history shows Perfume Set names`, hist)
  await page.waitForTimeout(400)
  await shot(page, `${locale}-history`, { fullPage: true })
  check(errors.length === 0, `${tag} no uncaught page errors`, errors.join(" | "))
  await page.close()
}

await browser.close()
server.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
