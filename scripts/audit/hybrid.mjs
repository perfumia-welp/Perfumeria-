// Run only against an isolated VITE_PRODUCT_SOURCE=live build. Every remote
// request is intercepted: the company API and Supabase answer with fixtures,
// anything else is aborted. No live company or Supabase read is performed.
import assert from "node:assert/strict"
import { launch } from "./lib.mjs"

const base = process.env.HYBRID_AUDIT_URL || "http://127.0.0.1:8444"
const API = "https://api.welpstar.com/api/v1/businesses/84116"
const browser = await launch()
try {
  const page = await browser.newPage()
  // A wishlist saved while the site ran on the mock catalogue (legacy key).
  await page.addInitScript(() => {
    if (!localStorage.getItem("perfumeria:wishlist")) localStorage.setItem("perfumeria:wishlist", '["velvet-iris","quiet-oud"]')
  })
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  let offline = false
  const welp = []
  let pageLoads = 0
  page.on("load", () => pageLoads++)
  const product = (id, changes) => ({ id, product_type: 1382, name: `Fixture ${id}`, description: "Company fixture description. 100ml", price_before_discount: null, price_after_discount: 1100, image: `${base}/images/packshots/velvet-iris.webp`, is_available: true, is_variation_available: false, is_offer: false, offer_valid_from: null, offer_valid_to: null, ...changes })
  const products = [
    product(19, { name: "Fixture Scent", price_before_discount: 1500 }),
    product(20, { name: "Unavailable Fixture", product_type: 1344, is_available: false, image: `${base}/images/packshots/quiet-oud.webp` }),
    product(21, { name: "Boxed Fixture", is_variation_available: true }),
  ]
  const variations = [{ id: 4800, name: "إختار", is_required: true, is_select_multiple: false, min_selection: 1, max_selection: 1, is_main_price: true, options: [
    { id: 12203, name: "بدون علبة", additional_price: null, price_before_discount: null, price_after_discount: 900 },
    { id: 12202, name: "بالعلبة", additional_price: null, price_before_discount: null, price_after_discount: 1100 },
  ] }]
  await page.route("**/*", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.href.startsWith(API)) {
      welp.push({ method: request.method(), path: url.pathname.replace("/api/v1/businesses/84116", ""), appId: request.headers()["app-id"] })
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } })
      const headers = { "access-control-allow-origin": "*" }
      if (offline) return route.fulfill({ status: 503, headers, json: { error: "unavailable" } })
      if (url.pathname.endsWith("/products") && url.searchParams.get("page") === "1")
        return route.fulfill({ headers, json: { codes: [], count: products.length, next: null, previous: null, page_size: 20, results: [...products].sort((a, b) => b.id - a.id).slice(0, 20) } })
      if (url.pathname.endsWith("/all-products"))
        return route.fulfill({ headers, json: { codes: [], data: [{ name: "Perfumes For Men", products: products.filter((p) => p.product_type === 1344) }, { name: "Perfumes for women", products: products.filter((p) => p.product_type === 1382) }] } })
      const id = Number(url.pathname.split("/").pop())
      return route.fulfill({ headers, json: { codes: [], data: { ...products.find((p) => p.id === id), variations: id === 21 ? variations : [] } } })
    }
    if (url.pathname.includes("/rest/v1/product_metadata")) return route.fulfill({ json: [{ business_id: 84116, product_id: 19, brand: "Fixture brand", fragrance_family: "woody", top_notes: ["Cedar"], heart_notes: [], base_notes: [], editorial_description_ar: "وصف عربي للتجربة" }] })
    if (url.pathname.includes("/rest/v1/product_gallery")) return route.fulfill({ json: [{ id: "gallery", business_id: 84116, product_id: 19, image_url: base + "/images/packshots/quiet-oud.webp", sort_order: 0, alt_en: "Fixture gallery" }] })
    if (url.origin !== new URL(base).origin) return route.abort()
    return route.continue()
  })

  // Catalogue: company products merged with (partial) Supabase data; no mock products.
  await page.goto(base + "/products", { waitUntil: "networkidle" })
  await page.getByRole("link", { name: "Fixture Scent", exact: true }).waitFor()
  assert.equal(await page.locator(".product-card").count(), 3)
  assert.equal(await page.getByRole("link", { name: "Velvet Iris", exact: true }).count(), 0)
  assert.equal(await page.getByRole("button", { name: "Add to bag, Unavailable Fixture" }).count(), 0)
  assert.match(await page.locator("main").textContent(), /EGP/)
  assert.doesNotMatch(await page.locator("main").textContent(), /US\$|\$/)
  // Price-changing options: "From" the lowest option (detail fetched for that card only).
  const boxedCard = page.locator(".product-card", { hasText: "Boxed Fixture" })
  await boxedCard.locator(".product-price__from").waitFor()
  assert.match(await boxedCard.locator(".product-card__price").textContent(), /From\s*EGP\s*900/)
  const plainCard = page.locator(".product-card", { hasText: "Fixture Scent" })
  assert.equal(await plainCard.locator(".product-price__from").count(), 0)
  assert.match(await plainCard.locator(".product-card__price").textContent(), /1,500.*1,100/)

  // Plain product: PDP gallery, description, add.
  await page.getByRole("button", { name: "Save to wishlist, Fixture Scent" }).click()
  await page.getByRole("link", { name: "Fixture Scent", exact: true }).click()
  await page.locator(".pdp__title").waitFor()
  assert.equal(await page.locator(".pdp-gallery__thumbs button").count(), 2)
  assert.match(await page.locator(".pdp__description").textContent(), /Company fixture description/)
  assert.equal(await page.locator("input[data-product-option]").count(), 0)
  await page.locator(".pdp__add").click()

  // Option product: the card offers Choose Options, which opens the product page; the pick sets price and line.
  // (In-app navigation: anonymous sign-in is blocked here, so the bag is visit memory and a reload would empty it.)
  await page.locator(".pdp__breadcrumb a").first().click()
  await page.getByRole("link", { name: "Choose options, Boxed Fixture" }).waitFor()
  await page.getByRole("link", { name: "Choose options, Boxed Fixture" }).click()
  await page.waitForURL(/\/products\/product-21$/)
  await page.locator("input[data-product-option]").first().waitFor()
  assert.match(await page.locator(".pdp__price").textContent(), /From\s*EGP\s*900/)
  await page.locator(".pdp__add").click()
  assert.match(await page.getByRole("alert").first().textContent(), /Choose an option/)
  await page.getByRole("radio", { name: /Without box/ }).check()
  assert.match(await page.locator(".pdp__price").textContent(), /900/)
  await page.locator(".pdp__add").click()
  await page.getByRole("radio", { name: /^With box/ }).check()
  assert.match(await page.locator(".pdp__price").textContent(), /1,100/)
  await page.locator(".pdp__add").click()
  await page.locator('.header-actions a[href$="/cart"]').click()
  await page.locator(".cart-line").first().waitFor()
  const lines = await page.locator(".cart-line").allTextContents()
  assert.equal(lines.length, 3, "plain + without box + with box are separate lines")
  assert.ok(lines.some((line) => /Boxed Fixture \(Without box\)/.test(line) && /900/.test(line)))
  assert.ok(lines.some((line) => /Boxed Fixture \(With box\)/.test(line)))
  assert.equal(await page.locator('.cart-line[data-product-id="21"]').count(), 0, "no option-less line for an option product")

  // Arabic: our Arabic where it exists, company English otherwise (marked lang=en).
  await page.locator(".header-language a", { hasText: "AR" }).click()
  await page.waitForURL(/\/ar\/cart$/)
  await page.waitForFunction(() => document.documentElement.dir === "rtl")
  assert.match((await page.locator(".cart-line").allTextContents()).join(" "), /Boxed Fixture \(بدون علبة\)/)
  await page.goto(base + "/ar/products/product-19", { waitUntil: "networkidle" })
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl")
  assert.equal(await page.locator(".pdp__description").textContent(), "وصف عربي للتجربة")
  await page.goto(base + "/ar/products/product-21", { waitUntil: "networkidle" })
  assert.equal(await page.locator(".pdp__description").getAttribute("lang"), "en")
  assert.match(await page.locator("fieldset:has(input[data-product-option]) legend").textContent(), /إختار/)

  // Client-side filters/search: gender from product type, family from Supabase.
  await page.goto(base + "/products?q=Fixture&gender=women&family=woody&sort=price-asc", { waitUntil: "networkidle" })
  assert.equal(await page.locator(".product-card").count(), 1)
  await page.goto(base + "/products?gender=men", { waitUntil: "networkidle" })
  assert.equal(await page.locator(".product-card").count(), 1)
  await page.goto(base + "/wishlist", { waitUntil: "networkidle" })
  assert.equal(await page.getByRole("link", { name: "Fixture Scent", exact: true }).count(), 1)
  // Live and mock wishlists are kept apart; the mock one is preserved, never shown live.
  const stored = await page.evaluate(() => [localStorage.getItem("perfumeria:wishlist:live"), localStorage.getItem("perfumeria:wishlist")])
  assert.deepEqual(stored, ['["19"]', '["velvet-iris","quiet-oud"]'])
  assert.equal(await page.locator("main .product-card").count(), 1)

  // Home: only real company discounts are offers; the placeholder 20% code never shows live.
  await page.goto(base + "/", { waitUntil: "networkidle" })
  await page.locator(".offers .product-card").first().waitFor()
  assert.deepEqual(await page.locator(".offers .product-card h3").allTextContents(), ["Fixture Scent"])
  assert.doesNotMatch(await page.locator("main").textContent(), /20%/)

  // Failure: error and retry, never mock products.
  offline = true
  // Within the same tab, the real catalogue fetched minutes ago is reused (short-lived session cache).
  await page.goto(base + "/products", { waitUntil: "networkidle" })
  assert.equal(await page.locator(".product-card").count(), 3)
  // A cold visit with the company API down: error and retry, no products at all.
  await page.evaluate(() => sessionStorage.removeItem("perfumeria:live-catalog:v1"))
  await page.goto(base + "/products", { waitUntil: "networkidle" })
  assert.match(await page.getByRole("alert").textContent(), /could not be loaded/)
  assert.equal(await page.locator(".product-card").count(), 0)
  offline = false
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await page.getByRole("link", { name: "Fixture Scent", exact: true }).waitFor()

  // Company API contract: GET (plus CORS preflight) with App-ID, fixed paths, no N+1.
  assert.ok(welp.every((call) => call.method === "GET" || call.method === "OPTIONS"), JSON.stringify(welp))
  assert.ok(welp.filter((call) => call.method === "GET").every((call) => call.appId === "WEBSITE"))
  assert.ok(welp.every((call) => ["/products", "/all-products", "/products/19", "/products/20", "/products/21"].includes(call.path)), JSON.stringify(welp.map((c) => c.path)))
  assert.ok(welp.filter((call) => call.method === "GET" && call.path === "/products/21").length <= pageLoads, "a product detail at most once per page load (cards and product page share it)")
  assert.ok(welp.filter((call) => call.method === "GET" && call.path === "/all-products").length <= pageLoads + 1, "at most one full catalogue request per page load (+1 for the Retry): " + JSON.stringify({ loads: pageLoads, full: welp.filter((c) => c.path === "/all-products").map((c) => c.method) }))
  assert.equal(await page.locator('[aria-label="Development: live catalogue"]').count(), 0, "dev badge absent from builds")
  assert.deepEqual(errors, [])
  console.log("PASS live catalogue browser: direct GET contract, merged/partial metadata, gallery, EGP, box options + separate bag lines, card add opens PDP, EN/AR fallback, filters/search, wishlist, error and retry; no live requests")
} finally {
  await browser.close()
}
