// Real public catalogue + built application. Never creates identities/orders or sends mail.
import { launch } from "./lib.mjs"
import { verifyOrder } from "../../server/orders.mjs"
const base = process.env.LIVE_AUDIT_URL || "http://localhost:8450"
const browser = await launch()
const failures = [], network = [], consoleErrors = [], timings = [], requests = []
let checks = 0
const check = (ok, label) => { checks++; if (!ok) failures.push(label) }
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.route("**/*", (route) => ["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort())
  page.on("response", (r) => { if (r.status() >= 400) network.push({ status: r.status(), url: r.url() }) })
  page.on("requestfailed", (r) => network.push({ error: r.failure()?.errorText, url: r.url() }))
  page.on("pageerror", (e) => consoleErrors.push(e.message))
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) consoleErrors.push(m.text()) })
  page.on("request", (r) => { if (r.url().includes("api.welpstar.com")) requests.push(r.url()) })
  page.on("response", async (r) => {
    if (/api.welpstar.com.*(?:all-products|products\?)/.test(r.url())) {
      await r.finished(); const t = r.request().timing(); timings.push({ api: r.url().includes("all-products") ? "full catalogue" : "first page", ms: Math.round(t.responseEnd) })
    }
  })
  let start = performance.now(); await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.locator(".hero-campaign").waitFor(); timings.push({ route: "home cold", ms: Math.round(performance.now() - start) })
  const all = await page.evaluate(async () => (await (await fetch("https://api.welpstar.com/api/v1/businesses/84116/all-products", { headers: { "App-ID": "WEBSITE", "Accept-Language": "EN" } })).json()).data.flatMap((g) => g.products))
  const representatives = [all.find((p) => !p.is_variation_available && p.is_available), all.find((p) => p.is_variation_available && p.is_available), all.find((p) => p.product_type === 1344), all.find((p) => p.product_type === 1382), all.find((p) => Number(p.price_before_discount) > Number(p.price_after_discount))].filter(Boolean)
  const ids = [...new Set(representatives.map((p) => p.id))]
  console.log(JSON.stringify({ catalogueCount: all.length, representativeIds: ids, plainAvailable: all.filter((p) => !p.is_variation_available && p.is_available).length, discountedBasePrices: all.filter((p) => Number(p.price_before_discount) > Number(p.price_after_discount)).length }))
  for (const id of ids) {
    const raw = await page.evaluate(async (id) => (await (await fetch(`https://api.welpstar.com/api/v1/businesses/84116/products/${id}`, { headers: { "App-ID": "WEBSITE", "Accept-Language": "EN" } })).json()).data, id)
    const options = (raw.variations ?? []).filter((v) => v.is_required).map((v) => ({ variationId: v.id, optionId: v.options[0].id }))
    const input = { reference: "PF-261022-READONLY", locale: "en", customer: { fullName: "Not submitted", phone: "+201001234567", email: "test@example.com" }, delivery: { address: "Not submitted", cityArea: "Not submitted" }, currency: "EGP", displayedTotal: -1, lines: [{ welpProductId: id, options, quantity: 1, unitPrice: -1 }] }
    try { await verifyOrder(input, { id: "read-only" }, async () => raw) } catch (e) { check(e.code === "price_changed" || e.code === "unavailable_product", `real Welp server normalization ${id}`) }
  }
  const routes = ["/", "/products", ...ids.map((id) => `/products/product-${id}`), "/men-perfumes", "/women-perfumes", "/about", "/contact", "/contact?topic=wholesale", "/contact?topic=track-order", "/faq", "/returns", "/guides/perfume-concentration", "/account", "/account/orders", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/cart", "/checkout"]
  for (const width of [1440, 768, 390]) for (const prefix of ["", "/ar"]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of routes) {
      const path = prefix + (route === "/" ? "" : route) || "/"
      const t = performance.now(); await page.goto(base + path, { waitUntil: "networkidle" })
      check(await page.locator("#main").count() === 1, `main rendered ${width} ${path}`)
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no overflow ${width} ${path}`)
      check(await page.locator(".testimonials").count() === 0, `no fake reviews ${width} ${path}`)
      check(await page.locator("html").getAttribute("lang") === (prefix ? "ar" : "en"), `locale ${width} ${path}`)
      if (width === 1440 && !prefix) timings.push({ route: path, ms: Math.round(performance.now() - t) })
    }
    console.log(`Completed ${width} ${prefix || "en"}`)
  }
  await page.goto(base + "/", { waitUntil: "networkidle" })
  console.log(JSON.stringify({ placeholders: await page.locator(".site-footer__placeholder").allTextContents() }))
  console.log(JSON.stringify({ checks, failures, consoleErrors: [...new Set(consoleErrors)], network, timings, catalogueRequests: requests.length }, null, 2))
  if (failures.length || consoleErrors.length || network.length) process.exitCode = 1
} finally { await browser.close() }
