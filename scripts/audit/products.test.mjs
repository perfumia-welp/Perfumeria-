import test from "node:test"
import assert from "node:assert/strict"
import { applySelection, optionPriceRange, normalizeImageUrl, normalizeProduct, normalizeVariations, localizedText, optionLabel } from "../../src/services/products/adapter.ts"
import { createProductRepository, parseProductSource } from "../../src/services/products/repository.ts"
import { parseSizeMl } from "../../src/services/products/size.ts"
import { pageWindow } from "../../src/components/products/pageWindow.ts"
import { createCatalogHandler } from "../../supabase/functions/company-catalog/handler.ts"

// Test fixtures only, shaped like the live WEBSITE responses (2026-10-16).
// They never enter application configuration or inventory.
const config = { businessId: 84116, currency: "EGP", mediaOrigin: "https://media.example.test", productTypeGender: { 1344: "men", 1382: "women" }, categoryNames: { 1382: "Perfumes for women" } }
const row = { id: 19, product_type: 1382, name: "Test Scent Eau de Parfum", description: "Company description. 100ML", price_before_discount: null, price_after_discount: 1100, image: "https://media.example.test/media/bottle.jpg", is_available: true, is_variation_available: false, is_offer: false, offer_valid_from: null, offer_valid_to: null }
const boxVariation = { id: 4800, name: "إختار", is_required: true, is_select_multiple: false, min_selection: 1, max_selection: 1, is_main_price: true, options: [
  { id: 12203, name: "بدون علبة", additional_price: null, price_before_discount: null, price_after_discount: 900 },
  { id: 12202, name: "بالعلبه", additional_price: null, price_before_discount: null, price_after_discount: 1100 },
] }
const normalize = (changes = {}, locale = "en", meta, gallery) => normalizeProduct({ ...row, ...changes }, config, locale, meta, gallery)

test("live product maps to the frontend model with business/product identity", () => {
  const p = normalize()
  assert.equal(p.id, "19"); assert.equal(p.businessId, 84116); assert.equal(p.productId, 19); assert.equal(p.slug, "product-19")
  assert.equal(p.name, "Test Scent Eau de Parfum"); assert.equal(p.description, "Company description. 100ML")
  assert.equal(p.currency, "EGP"); assert.equal(p.category.id, 1382); assert.equal(p.category.name, "Perfumes for women")
  assert.equal(p.requiresOptionSelection, false); assert.deepEqual(p.variations, [])
})
test("gender comes from the company product type; metadata may override; unknown types stay unknown", () => {
  assert.equal(normalize().gender, "women")
  assert.equal(normalize({ product_type: 1344 }).gender, "men")
  assert.equal(normalize({ product_type: 999 }).gender, undefined)
  assert.equal(normalize({ product_type: null }).gender, undefined)
  assert.equal(normalize({}, "en", { business_id: 84116, product_id: 19, gender: "unisex" }).gender, "unisex")
})
test("Arabic: our Supabase Arabic first, otherwise company English marked as English", () => {
  const fallback = normalize({}, "ar")
  assert.equal(fallback.name, "Test Scent Eau de Parfum"); assert.equal(fallback.description, "Company description. 100ML")
  assert.deepEqual(fallback.contentLocale, { name: "en", description: "en" })
  assert.equal(fallback.translations.name.ar, null)
  const meta = { business_id: 84116, product_id: 19, name_ar: "عطر تجريبي", editorial_description_ar: "وصف عربي" }
  const ar = normalize({}, "ar", meta)
  assert.equal(ar.name, "عطر تجريبي"); assert.equal(ar.description, "وصف عربي"); assert.deepEqual(ar.contentLocale, { name: "ar", description: "ar" })
  const en = normalize({}, "en", meta)
  assert.equal(en.name, "Test Scent Eau de Parfum"); assert.equal(en.description, "Company description. 100ML")
  assert.equal(localizedText({ en: null, ar: "وصف" }, "en"), "وصف")
})
test("prices: after is current; before only when a valid higher price", () => {
  assert.equal(normalize().price, 1100); assert.equal(normalize().compareAtPrice, undefined)
  assert.deepEqual([normalize({ price_before_discount: 1500 }).price, normalize({ price_before_discount: 1500 }).compareAtPrice], [1100, 1500])
  for (const before of [1100, 900, "", "oops", -5]) assert.equal(normalize({ price_before_discount: before }).compareAtPrice, undefined)
  assert.equal(normalize({ price_after_discount: "1200" }).price, 1200); assert.equal(normalize({ price_after_discount: 0 }).price, 0)
  for (const after of [null, "", -1, NaN, "oops"]) assert.throws(() => normalize({ price_after_discount: after }))
})
test("images: absolute company URLs pass; unsafe or relative-without-origin rejected", () => {
  assert.equal(normalize().packshot.src, "https://media.example.test/media/bottle.jpg")
  assert.equal(normalize({ image: "/media/x.png" }).packshot.src, "https://media.example.test/media/x.png")
  assert.throws(() => normalizeImageUrl("/media/x"))
  for (const value of ["javascript:alert(1)", "//evil.test/x", "https://user:secret@cdn.example.test/x", ""]) assert.throws(() => normalizeImageUrl(value, config.mediaOrigin))
})
test("missing supplemental data is empty, never invented", () => {
  const p = normalize()
  assert.equal(p.brand, undefined); assert.equal(p.family, undefined); assert.equal(p.fragranceFamily, undefined)
  assert.deepEqual(p.notes, []); assert.deepEqual(p.gallery, []); assert.equal(p.ingredients, undefined)
  assert.deepEqual(p.story, { description: "Company description. 100ML", composition: { top: [], heart: [], base: [] }, character: [] })
})
test("malformed company values fail instead of becoming fake catalogue data", () => {
  for (const changes of [
    { id: Number.MAX_SAFE_INTEGER + 1 }, { id: 0 }, { id: "19" }, { is_available: "true" },
    { product_type: "men" }, { product_type: -1 }, { name: " " }, { name: { en: "x" } }, { description: 5 },
  ]) assert.throws(() => normalize(changes))
})
test("supplemental merge needs both identities and never overrides commercial data", () => {
  const meta = { business_id: 84116, product_id: 19, brand: "Fixture brand", fragrance_family: "woody", top_notes: ["Bergamot"], heart_notes: ["Rose"], base_notes: ["Cedar"], price: 1, name: "Override" }
  const p = normalize({}, "en", meta)
  assert.equal(p.brand, "Fixture brand"); assert.equal(p.family, "woody"); assert.deepEqual(p.notes, ["Bergamot", "Rose", "Cedar"])
  assert.equal(p.price, 1100); assert.equal(p.name, "Test Scent Eau de Parfum")
  assert.equal(normalize({}, "en", { ...meta, business_id: 1 }).brand, undefined)
  assert.equal(normalize({}, "en", { ...meta, product_id: 20 }).brand, undefined)
})
test("gallery joins both identities, orders deterministically and localizes alt", () => {
  const gallery = [
    { id: "b", business_id: 84116, product_id: 19, sort_order: 2, image_url: "/b", alt_en: "Back" },
    { id: "a", business_id: 84116, product_id: 19, sort_order: 1, image_url: "/a", alt_ar: "أمام" },
    { id: "c", business_id: 1, product_id: 19, sort_order: 0, image_url: "/wrong" },
  ]
  const p = normalize({}, "ar", undefined, gallery)
  assert.deepEqual(p.gallery.map((x) => x.src), ["https://media.example.test/a", "https://media.example.test/b"])
  assert.deepEqual(p.gallery.map((x) => x.alt), ["أمام", "Back"])
  assert.equal(p.packshot.src, "https://media.example.test/media/bottle.jpg", "company image stays primary")
})
test("size parser: obvious ml only, one value, no sets; text untouched", () => {
  assert.equal(parseSizeMl("X", "Saffron, Jasmine.100ML"), 100)
  assert.equal(parseSizeMl("MUSAMAM BLACK INTENSE 100 ML"), 100)
  assert.equal(parseSizeMl("X", "50ml ... 50 ml"), 50)
  assert.equal(parseSizeMl("X 75 Ml"), 75)
  assert.equal(parseSizeMl("X", "100ml and 150ml"), undefined)
  assert.equal(parseSizeMl("BLEU DE CHANEL GIFT SET", "100ml"), undefined)
  assert.equal(parseSizeMl("X", "7 x 40ml EDP"), undefined)
  assert.equal(parseSizeMl("X", "3.4 oz"), undefined)
  assert.equal(parseSizeMl("X", "1.5ml"), undefined)
  assert.equal(parseSizeMl("X", "no size"), undefined)
  const p = normalize()
  assert.equal(p.size, "100ml"); assert.equal(p.sizeSource, "parsed"); assert.equal(p.description, "Company description. 100ML")
  const curated = normalize({}, "en", { business_id: 84116, product_id: 19, size_ml: 75 })
  assert.equal(curated.size, "75ml"); assert.equal(curated.sizeSource, "metadata")
})
test("box / no-box variations keep ids, labels and prices; known labels get English", () => {
  const p = normalize({ is_variation_available: true, variations: [boxVariation] })
  assert.equal(p.requiresOptionSelection, true)
  const [v] = p.variations
  assert.equal(v.id, "4800"); assert.equal(v.required, true); assert.equal(v.replacesPrice, true)
  assert.deepEqual(v.name, { en: "Choose", ar: "إختار" })
  assert.deepEqual(v.options.map((o) => [o.id, o.name.en, o.name.ar, o.price]), [["12203", "Without box", "بدون علبة", 900], ["12202", "With box", "بالعلبه", 1100]])
  assert.deepEqual(optionLabel("Gift wrap"), { en: "Gift wrap", ar: "Gift wrap" })
  for (const bad of [[{ ...boxVariation, options: [] }], [{ ...boxVariation, id: "x" }], [{ ...boxVariation, is_select_multiple: true }], [{ ...boxVariation, options: [{ id: 0, name: "x" }] }], "nope"])
    assert.throws(() => normalizeVariations(bad))
})
test("main-price option replaces the base price and makes a distinct, safe bag line", () => {
  const p = normalize({ is_variation_available: true, variations: [boxVariation] })
  assert.throws(() => applySelection(p, {}, "en"), /required/)
  assert.throws(() => applySelection(p, { 4800: "99" }, "en"))
  assert.throws(() => applySelection(p, { 4800: "12203", 1: "2" }, "en"))
  const without = applySelection(p, { 4800: "12203" }, "en")
  const withBox = applySelection(p, { 4800: "12202" }, "ar")
  assert.equal(without.price, 900); assert.equal(without.compareAtPrice, undefined); assert.equal(withBox.price, 1100)
  assert.equal(without.id, "19~12203"); assert.notEqual(without.id, withBox.id)
  assert.equal(without.name, "Test Scent Eau de Parfum (Without box)"); assert.equal(withBox.name, "Test Scent Eau de Parfum (بالعلبه)")
  assert.deepEqual(without.selectedOptions, [{ variationId: 4800, optionId: 12203, label: { en: "Without box", ar: "بدون علبة" } }])
  assert.equal(without.productId, 19); assert.equal(without.businessId, 84116); assert.equal(without.requiresOptionSelection, false)
  const plain = normalize()
  assert.equal(applySelection(plain, {}, "en").id, "19")
})
test("From price: lowest required main-price option; none without price-changing options", () => {
  const boxed = normalize({ is_variation_available: true, variations: [boxVariation] })
  assert.deepEqual(optionPriceRange(boxed), { min: 900, max: 1100 })
  const same = normalize({ variations: [{ ...boxVariation, options: boxVariation.options.map((o) => ({ ...o, price_after_discount: 1000 })) }] })
  assert.deepEqual(optionPriceRange(same), { min: 1000, max: 1000 }, "equal options: exact price, no From")
  assert.equal(optionPriceRange(normalize()), undefined)
  assert.equal(optionPriceRange(normalize({ variations: [{ ...boxVariation, is_main_price: false, options: [{ id: 1, name: "Gift wrap", additional_price: 50 }] }] })), undefined)
  assert.equal(optionPriceRange(applySelection(boxed, { 4800: "12203" }, "en")) .min, 900)
})
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
/** The real /all-products takes ~3 s, far longer than the first page. */
const slow = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 20))
const repoOptions = (changes = {}) => ({
  source: "live", config, mock: () => { throw new Error("mock used") },
  firstPage: async () => ({ products: [{ ...row, id: 21 }], total: 3 }),
  company: async () => ({ products: [row, { ...row, id: 20, is_variation_available: true }, { ...row, id: 21 }], categoryNames: { 1382: "Perfumes for women" } }),
  supplemental: async (business) => { assert.equal(business, 84116); return { metadata: [{ business_id: 84116, product_id: 19, brand: "Fixture brand" }], gallery: [] } },
  detail: async (id) => ({ ...row, id, is_variation_available: true, variations: [boxVariation] }),
  ...changes,
})
test("repository: mock makes no remote calls; live failure never falls back to mock", async () => {
  let mocks = 0
  const failing = repoOptions({ mock: () => { mocks++; return [] }, firstPage: async () => { throw new Error("offline") }, company: async () => { throw new Error("offline") } })
  const mock = createProductRepository({ ...failing, source: "mock" })
  await mock.load(); assert.deepEqual(mock.getCatalog("en"), []); assert.equal(mocks, 1); assert.equal(mock.state().complete, true)
  const live = createProductRepository(failing)
  await assert.rejects(live.load(), /offline/); assert.throws(() => live.getCatalog("en"), /unavailable/); assert.equal(mocks, 1)
  await assert.rejects(createProductRepository(repoOptions({ supplemental: async () => { throw new Error("metadata offline") } })).load(), /metadata offline/)
  await assert.rejects(createProductRepository(repoOptions({ firstPage: async () => ({ products: [], total: 0 }), company: () => slow({ products: [], categoryNames: {} }) })).load(), /empty/)
  // A failed first page is rescued by the full catalogue when that arrives.
  const rescued = createProductRepository(repoOptions({ firstPage: async () => { throw new Error("page offline") } }))
  await rescued.load(); assert.equal(rescued.state().complete, true)
  await assert.rejects(createProductRepository(repoOptions({ company: async () => ({ products: [row, row], categoryNames: {} }) })).loadAll(), /Duplicate/)
  assert.equal(parseProductSource(), "mock"); assert.equal(parseProductSource("live"), "live")
  for (const value of ["automatic", "hybrid"]) assert.throws(() => parseProductSource(value))
})
test("repository: first page renders, full catalogue follows newest-first; a failed full load is reported", async () => {
  let changes = 0
  let full
  const repo = createProductRepository(repoOptions({ onChange: () => changes++, company: () => (full = slow(repoOptions().company()).then((p) => p)) }))
  await repo.load()
  assert.deepEqual(repo.getCatalog("en").map((p) => p.id), ["21"]); assert.deepEqual(repo.state(), { complete: false, total: 3, failed: false })
  await full; await tick()
  assert.deepEqual(repo.getCatalog("en").map((p) => p.id), ["21", "20", "19"], "same order as the company /products pages")
  assert.equal(repo.state().complete, true); assert.ok(changes >= 1)
  const broken = createProductRepository(repoOptions({ company: () => slow().then(() => { throw new Error("slow upstream") }) }))
  await broken.load(); await slow(); await tick()
  assert.deepEqual(broken.state(), { complete: false, total: 3, failed: true })
  assert.deepEqual(broken.getCatalog("en").map((p) => p.id), ["21"], "first page stays; never mock")
})
test("repository: session cache shows the full catalogue at once and refreshes it", async () => {
  let saved
  let fresh = false
  const cache = { read: () => saved && { snapshot: saved, fresh }, write: (snapshot) => { saved = snapshot } }
  let firstPages = 0, fulls = 0
  const options = repoOptions({ cache, firstPage: async () => { firstPages++; return { products: [{ ...row, id: 21 }], total: 3 } }, company: async () => { fulls++; return { products: [row, { ...row, id: 21 }], categoryNames: {} } } })
  const first = createProductRepository(options)
  await first.load(); await tick()
  assert.equal(saved.products.length, 2); assert.equal(firstPages, 1)
  const second = createProductRepository(options)
  await second.load()
  assert.equal(second.state().complete, true, "cached catalogue is complete immediately"); assert.equal(firstPages, 1, "no first-page wait")
  await tick(); assert.equal(fulls, 2, "one full load per visit (in-flight load reused); the cached visit refreshes in the background")
  fresh = true
  const third = createProductRepository(options)
  await third.load(); await tick()
  assert.equal(third.state().complete, true); assert.equal(fulls, 2, "a fresh cache is not downloaded again")
})
test("adapter: company images get a resized srcSet only when a resizer is configured", () => {
  const plain = normalizeProduct(row, config, "en")
  assert.equal(plain.packshot.srcSet, undefined)
  const resized = normalizeProduct(row, { ...config, imageResizer: "https://resizer.test/", imageWidths: [320, 640] }, "en")
  assert.equal(resized.packshot.src, "https://media.example.test/media/bottle.jpg", "the original stays the src (fallback, SEO)")
  assert.equal(
    resized.packshot.srcSet,
    "https://resizer.test/?url=https%3A%2F%2Fmedia.example.test%2Fmedia%2Fbottle.jpg&w=320&we&output=webp&q=82 320w, https://resizer.test/?url=https%3A%2F%2Fmedia.example.test%2Fmedia%2Fbottle.jpg&w=640&we&output=webp&q=82 640w",
  )
})
test("repository: merges empty or partial Supabase data, skips malformed rows, details on demand once", async () => {
  let details = 0
  const repo = createProductRepository(repoOptions({
    company: async () => ({ products: [row, { ...row, id: 20 }, { ...row, id: 22, price_after_discount: "bad" }], categoryNames: {} }),
    detail: async (id) => { details++; return { ...row, id, is_variation_available: true, variations: [boxVariation] } },
  }))
  await repo.load(); await tick()
  assert.deepEqual(repo.getCatalog("en").map((p) => p.id), ["20", "19"]); assert.equal(repo.skipped, 1)
  assert.equal(repo.getCatalog("ar")[1].brand, "Fixture brand"); assert.equal(repo.getCatalog("en")[0].brand, undefined)
  assert.equal(repo.getDetail(20, "en"), undefined)
  await Promise.all([repo.loadDetail(20), repo.loadDetail(20)]); await repo.loadDetail(20)
  assert.equal(details, 1); assert.equal(repo.getDetail(20, "ar").variations[0].options[0].name.ar, "بدون علبة")
})
test("pagination window: first, last, current and neighbours with gaps; never hides a single page", () => {
  const show = (page, count, siblings) => pageWindow(page, count, siblings).map((slot) => slot === "gap" ? "…" : slot).join(" ")
  assert.equal(show(8, 31, 1), "1 … 7 8 9 … 31")
  assert.equal(show(8, 31, 0), "1 … 8 … 31")
  assert.equal(show(1, 31, 1), "1 2 … 31")
  assert.equal(show(3, 31, 1), "1 2 3 4 … 31")
  assert.equal(show(31, 31, 1), "1 … 30 31")
  assert.equal(show(29, 31, 1), "1 … 28 29 30 31")
  assert.equal(show(2, 3, 0), "1 2 3")
  assert.equal(show(1, 1, 1), "1")
})
// The public API needs no token; one is still never leaked if a future upstream requires it.
const server = { ...config, baseUrl: "https://company.example.test", token: "TEST_SECRET", allowedOrigin: "https://shop.example.test" }
const request = (query = "operation=list-products", method = "GET") => new Request(`https://edge.example.test/company-catalog?${query}`, { method })
test("unused proxy still rejects writes and client-controlled paths, methods, duplicate params, invalid IDs", async () => {
  let calls = 0
  const handler = createCatalogHandler(server, async () => { calls++; return [row] })
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD"]) assert.equal((await handler(request(undefined, method))).status, 405)
  for (const query of ["operation=orders", "operation=list-products&path=/orders", "operation=list-products&method=POST", "operation=get-product&productId=../1", "operation=list-products&operation=get-product", "operation=list-products&productId=1"]) assert.equal((await handler(request(query))).status, 400)
  assert.equal(calls, 0)
})
test("unused proxy: unavailable without reader; sanitized allowlist responses and errors", async () => {
  assert.equal((await createCatalogHandler(null)(request())).status, 503)
  assert.equal((await createCatalogHandler(server)(request())).status, 503)
  const response = await createCatalogHandler(server, async () => [{ ...row, token: server.token, internal: { owner: "secret" } }])(request())
  assert.equal(response.status, 200)
  const body = await response.text(); assert.ok(!body.includes(server.token)); assert.ok(!body.includes("internal")); assert.ok(!body.includes(server.baseUrl))
  const failure = await createCatalogHandler(server, async () => { throw new Error(server.token) })(request())
  assert.equal(failure.status, 502); assert.ok(!(await failure.text()).includes(server.token))
  assert.equal((await createCatalogHandler(server)(new Request("https://edge.example.test?operation=list-products", { headers: { Origin: "https://wrong.example.test" } }))).status, 403)
})
test("unused proxy: detail (with sanitized options), categories and OPTIONS", async () => {
  const handler = createCatalogHandler(server, async (op) => op.kind === "get-product" ? { ...row, variations: [{ ...boxVariation, secret: "x" }] } : [{ id: 2, name_en: "Perfume", secret: "hidden" }])
  const detail = await handler(request("operation=get-product&productId=19"))
  assert.equal(detail.status, 200); assert.ok(!(await detail.text()).includes("secret"))
  assert.equal((await handler(request("operation=get-product&productId=20"))).status, 502)
  const categories = await (await handler(request("operation=list-categories"))).json()
  assert.deepEqual(categories.categories, [{ id: 2, name_en: "Perfume" }])
  assert.equal((await handler(request(undefined, "OPTIONS"))).status, 204)
})
test("adapter: Arabic name and description — Supabase first, then the site's config, never on English pages", () => {
  const hero = { ...row, id: 14097, name: "Yves Saint Laurent Mon Paris Eau de Parfum" }
  const en = normalizeProduct(hero, config, "en")
  assert.equal(en.name, "Yves Saint Laurent Mon Paris Eau de Parfum", "English stays the company name")
  const ar = normalizeProduct(hero, config, "ar")
  assert.match(ar.name, /^إيف سان لوران مون باريس/)
  assert.deepEqual(ar.contentLocale, { name: "ar", description: "ar" })
  const meta = { business_id: 84116, product_id: 14097, name_ar: "اسم من Supabase", editorial_description_ar: "وصف من Supabase" }
  const fromDb = normalizeProduct(hero, config, "ar", meta)
  assert.equal(fromDb.name, "اسم من Supabase"); assert.equal(fromDb.description, "وصف من Supabase")
  const other = normalizeProduct(row, config, "ar")
  assert.equal(other.name, row.name, "no Arabic anywhere: the company English, marked as such")
  assert.equal(other.contentLocale.name, "en")
})
