// Sale presentation only: live-build fixtures, no external requests or writes.
import assert from "node:assert/strict"
import fs from "node:fs"
import sharp from "sharp"
import { launch, WIDTHS } from "./lib.mjs"

const base = process.env.HYBRID_AUDIT_URL || "http://127.0.0.1:18560"
const baseline = process.env.BASELINE_URL
const out = new URL("./output/sale-ui/", import.meta.url)
fs.mkdirSync(out, { recursive: true })
const browser = await launch()
let checks = 0
const comparisons = []
const check = (ok, label) => { assert.ok(ok, label); checks++; console.log(`PASS ${label}`) }
function fixtures(origin) {
  const product = (id, extra = {}) => ({ id, product_type: 1344, name: `Scent ${id}`, description: "100ml", image: `${origin}/images/packshots/velvet-iris.webp`, price_after_discount: 1100, is_available: true, is_variation_available: false, ...extra })
  return [product(19), product(20, { name: "A very long discounted fragrance name for wrapping protection", price_before_discount: 1500 }),
    product(21, { price_before_discount: 1600, is_variation_available: true, variations: [{ id: 4800, name: "Choose", is_required: true, is_main_price: true, options: [
      { id: 12203, name: "Without box", price_before_discount: 1100, price_after_discount: 900 },
      { id: 12202, name: "With box", price_before_discount: 1100, price_after_discount: 1100 },
    ] }] }), product(22, { price_before_discount: 1100 }), product(23, { price_before_discount: 1100, price_after_discount: 0 }),
    product(24, { price_before_discount: 1100, price_after_discount: null }), product(25, { price_before_discount: 1100, price_after_discount: "bad" }),
    product(26, { price_before_discount: 900 }),
    // A portrait photo (2:3): its drawn corner sits lower and further in than a square one's.
    product(27, { name: "Portrait discounted", price_before_discount: 1500, image: `${origin}/images/hero/amber-editorial-700.webp` }),
    // The real company record of a discounted product (11/2026), field for field; only the image is local.
    { id: 10849, product_type: 1344, name: "ASAD ELIXIR EDP", description: "Lattafa Asad Elixir\r\n\r\nA rich and captivating fragrance.", price_before_discount: 1500, price_after_discount: 1100, image: `${origin}/images/packshots/velvet-iris.webp`, is_available: true, is_variation_available: false, is_offer: false, offer_valid_from: null, offer_valid_to: null }]
}
/*
 * Where the percentage sits on a catalogue card: inside the photograph as
 * drawn (object-fit: contain, so a square or portrait photo leaves bands
 * inside its frame), measured against the heart and the index.
 */
const photoBadge = (locator) => locator.evaluate(el => {
  const box = r => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })
  const img = el.querySelector(".product-card__stage img"), f = img.getBoundingClientRect()
  const ratio = img.naturalWidth / img.naturalHeight, frame = f.width / f.height
  const w = ratio > frame ? f.width : f.height * ratio, h = ratio > frame ? f.width / ratio : f.height
  const photoStage = !!el.querySelector(".product-card__stage--photo")
  const left = f.left + (f.width - w) / 2, top = f.top + (photoStage ? (f.height - h) / 2 : f.height - h)
  const badge = el.querySelector(".product-card__photo-badge"), s = getComputedStyle(badge)
  return {
    loaded: img.complete && img.naturalWidth > 0,
    photo: { left, top, right: left + w, bottom: top + h },
    badge: box(badge.getBoundingClientRect()),
    heart: box(el.querySelector(".product-card__wishlist .icon, .product-card__wishlist svg").getBoundingClientRect()),
    heartTarget: box(el.querySelector(".product-card__wishlist").getBoundingClientRect()),
    index: box(el.querySelector(".product-card__index").getBoundingClientRect()),
    shown: s.display !== "none" && s.visibility === "visible" && Number(s.opacity) === 1,
    text: badge.innerText.trim(),
  }
})
const overlaps = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
const loadPhoto = (locator) => locator.evaluate(async el => {
  el.scrollIntoView({ block: "center", behavior: "instant" })
  const img = el.querySelector(".product-card__stage img")
  if (!img.complete) await new Promise(resolve => { img.addEventListener("load", resolve, { once: true }); img.addEventListener("error", resolve, { once: true }) })
  // The card learns the photo's shape on load and re-renders: wait for that, at most 3 s.
  const stage = el.querySelector(".product-card__stage")
  for (let i = 0; i < 180; i++) {
    const set = parseFloat(stage.style.getPropertyValue("--photo-ratio"))
    if (img.naturalWidth > 0 && Math.abs(set - img.naturalWidth / img.naturalHeight) < 0.01) break
    await new Promise(requestAnimationFrame)
  }
  await new Promise(requestAnimationFrame)
})
function checkPhotoBadge(r, tag, label, rtl) {
  const inset = { left: r.badge.left - r.photo.left, top: r.badge.top - r.photo.top }
  check(r.loaded && r.shown && r.text === "−27%", `${tag} ${label} −27% badge shown`)
  check(r.badge.left >= r.photo.left && r.badge.top >= r.photo.top && r.badge.right <= r.photo.right && r.badge.bottom <= r.photo.bottom, `${tag} ${label} badge inside the drawn photo`)
  check(inset.left >= 5 && inset.left <= 9 && r.badge.left - r.photo.left < (r.photo.right - r.photo.left) / 2, `${tag} ${label} badge on the photo's left edge (${inset.left.toFixed(1)}px in)`)
  // Arabic: the heart holds the stage's top-left corner, so the badge may drop below it.
  check(rtl ? inset.top >= 5 : inset.top >= 5 && inset.top <= 9, `${tag} ${label} badge at the photo's top (${inset.top.toFixed(1)}px in)`)
  check(!overlaps(r.badge, r.heartTarget) && !overlaps(r.badge, r.index), `${tag} ${label} badge clear of heart target and index`)
}
async function pageAt(origin, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" })
  const products = fixtures(origin)
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
    if (url.origin === new URL(origin).origin) return route.continue()
    if (url.hostname === "api.welpstar.com") {
      const json = url.pathname.endsWith("all-products") ? { data: [{ name: "Men", products }] } : url.pathname.endsWith("products") ? { count: products.length, results: products } : { data: products.find(p => p.id === Number(url.pathname.split("/").pop())) }
      return route.fulfill({ json })
    }
    if (/\/rest\/v1\/product_(metadata|gallery)/.test(url.pathname)) return route.fulfill({ json: [] })
    return route.abort()
  })
  return page
}
const card = (page, id) => page.locator(".product-card").filter({ has: page.locator(`a.product-card__link[href$="/product-${id}"]`) })
async function screenshot(page, locator) {
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}.contact-launcher,.mobile-whatsapp{visibility:hidden!important}" })
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))) })
  return locator.screenshot()
}
try {
  for (const width of WIDTHS) for (const locale of ["en", "ar"]) {
    const prefix = locale === "ar" ? "/ar" : "", tag = `${locale}/${width}`
    const p = await pageAt(base, width), errors = []
    p.on("pageerror", e => errors.push(e.message))
    await p.goto(base + prefix + "/products", { waitUntil: "networkidle" })
    check(await card(p, 19).locator(".product-sale-badge, s").count() === 0, `${tag} normal card unchanged sale state`)
    for (const id of [21, 22, 23, 26]) check(await card(p, id).locator(".product-sale-badge, s").count() === 0, `${tag} ${id} no false/ambiguous sale`)
    for (const id of [24, 25]) check(await card(p, id).count() === 0, `${tag} invalid after-price remains excluded by existing adapter`)
    const sale = card(p, 20)
    check(await sale.locator(".product-sale-badge").count() === 1 && await sale.locator(".product-sale-badge").innerText() === "−27%", `${tag} percentage is the only badge`)
    check(!/\bSALE\b|خصم/i.test(await sale.locator(".product-card__stage").innerText()), `${tag} no SALE label on the image`)
    check(/^\d\d$/.test((await sale.locator(".product-card__index").innerText()).trim()) && await sale.locator(".product-card__index").isVisible(), `${tag} decorative index preserved`)
    check(await sale.locator(".product-price--sale > span").first().getAttribute("class") === "product-card__current-price" && await sale.locator("s").count() === 1, `${tag} selling price first, original struck through`)
    await loadPhoto(sale)
    checkPhotoBadge(await photoBadge(sale), tag, "square photo:", locale === "ar")
    const portrait = card(p, 27)
    await loadPhoto(portrait)
    checkPhotoBadge(await photoBadge(portrait), tag, "portrait photo:", locale === "ar")
    const normalRects = await card(p, 19).evaluate(el => {
      const s = el.querySelector(".product-card__stage").getBoundingClientRect()
      const at = sel => { const r = el.querySelector(sel).getBoundingClientRect(); return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height } }
      return { heart: at(".product-card__wishlist"), image: at(".product-card__stage img"), index: at(".product-card__index"), stageHeight: s.height }
    })
    const saleRects = await sale.evaluate(el => {
      const s = el.querySelector(".product-card__stage").getBoundingClientRect()
      const at = sel => { const r = el.querySelector(sel).getBoundingClientRect(); return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height } }
      return { heart: at(".product-card__wishlist"), image: at(".product-card__stage img"), index: at(".product-card__index"), stageHeight: s.height }
    })
    const same = (a, b) => ["x", "y", "w", "h"].every(k => Math.abs(a[k] - b[k]) < 0.6)
    check(same(saleRects.heart, normalRects.heart) && same(saleRects.image, normalRects.image) && Math.abs(saleRects.stageHeight - normalRects.stageHeight) < 0.6, `${tag} heart, image and stage match a normal card`)
    check(Math.abs(saleRects.index.y - normalRects.index.y) < 0.6, `${tag} index keeps its height on the image`)
    if (locale === "ar") { const edge = r => r.x + r.w, delta = Math.abs(edge(saleRects.index) - edge(normalRects.index)); check(delta < 0.6, `${tag} Arabic index keeps its right edge (off by ${delta.toFixed(2)}px)`) }
    const prices = await sale.evaluate((el, rtl) => {
      const current = el.querySelector(".product-card__current-price"), original = el.querySelector(".product-price__original"), s = el.querySelector("s")
      const c = current.getBoundingClientRect(), o = original.getBoundingClientRect()
      return {
        oneLine: o.top < c.bottom - 4 && o.bottom > c.top + 4,
        order: rtl ? c.left > o.left : c.left < o.left,
        ratio: parseFloat(getComputedStyle(original).fontSize) / parseFloat(getComputedStyle(current).fontSize),
        struck: getComputedStyle(s).textDecorationLine === "line-through",
        gap: rtl ? c.left - o.right : o.left - c.right,
      }
    }, locale === "ar")
    check(prices.oneLine, `${tag} current and original price share one line`)
    check(prices.order, `${tag} current price reads first`)
    check(prices.ratio >= 0.85 - 0.001 && prices.ratio <= 0.9 && prices.struck, `${tag} original price 10-15 percent smaller and struck through`)
    check(prices.gap >= 5 && prices.gap <= 9, `${tag} price gap ${prices.gap.toFixed(1)}px`)
    const hits = await sale.evaluate(el => {
      el.querySelector(".product-card__stage").scrollIntoView({ block: "center", behavior: "instant" })
      const heart = el.querySelector(".product-card__wishlist")
      const r = heart.getBoundingClientRect()
      const mx = r.left + r.width / 2, my = r.top + r.height / 2
      const points = [[mx, my], [r.left + 2, my], [r.right - 2, my], [mx, r.top + 2], [mx, r.bottom - 2]]
      const label = el.querySelector(".product-sale-badge").getBoundingClientRect()
      return {
        heart: points.every(([x, y]) => heart.contains(document.elementFromPoint(x, y))) && r.width >= 40 && r.height >= 40,
        through: !!document.elementFromPoint(label.left + label.width / 2, label.top + label.height / 2)?.closest(".product-card__image-link"),
      }
    })
    check(hits.heart, `${tag} full 40px heart target stays clickable`)
    check(hits.through, `${tag} badge never blocks the image link`)
    const contrast = await sale.evaluate(el => {
      const rgb = c => c.match(/[\d.]+/g).slice(0, 3).map(Number)
      const lum = c => { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
      const surface = node => { for (; node; node = node.parentElement) { const c = getComputedStyle(node).backgroundColor; if (!/rgba\(.*, 0\)|transparent/.test(c)) return c } return "rgb(255, 255, 255)" }
      const badge = getComputedStyle(el.querySelector(".product-sale-badge")), s = el.querySelector("s")
      return { badge: ratio(badge.color, badge.backgroundColor), original: ratio(getComputedStyle(s).color, surface(s)) }
    })
    console.log(`INFO ${tag} contrast badge ${contrast.badge.toFixed(2)}:1, original price ${contrast.original.toFixed(2)}:1`)
    check(contrast.badge >= 4.5 && contrast.original >= 4.5, `${tag} badge and original price pass WCAG AA`)
    const spoken = (await sale.locator(".product-card__price").textContent()).replace(/\s+/g, " ").trim()
    check(spoken.includes(locale === "ar" ? "السعر بعد الخصم" : "Sale price") && spoken.includes(locale === "ar" ? "السعر الأصلي" : "Original price") && !spoken.includes("%"), `${tag} screen readers hear each price once, labelled`)
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag} listing no overflow`)
    const after = await screenshot(p, card(p, 19))
    fs.writeFileSync(new URL(`normal-${tag.replace("/", "-")}-after.png`, out), after)
    if (baseline) {
      const b = await pageAt(baseline, width); await b.goto(baseline + prefix + "/products", { waitUntil: "networkidle" })
      const before = await screenshot(b, card(b, 19)); fs.writeFileSync(new URL(`normal-${tag.replace("/", "-")}-before.png`, out), before)
      const a = await sharp(before).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), z = await sharp(after).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      let diff = 0; for (let i = 0; i < Math.min(a.data.length, z.data.length); i += 4) if (Math.abs(a.data[i]-z.data[i])+Math.abs(a.data[i+1]-z.data[i+1])+Math.abs(a.data[i+2]-z.data[i+2]) > 30) diff++
      comparisons.push({ tag, diff, before: a.info, after: z.info }); await b.close()
    }
    await screenshot(p, sale).then(buf => fs.writeFileSync(new URL(`sale-${tag.replace("/", "-")}.png`, out), buf))
    // The real Products page path, as a customer reaches it: search finds the live-shaped record.
    await p.goto(base + prefix + "/products?q=" + encodeURIComponent("asad elixir edp"), { waitUntil: "networkidle" })
    const real = card(p, 10849)
    check(await real.count() === 1 && /\bproduct-card--packshot\b/.test(await real.getAttribute("class")), `${tag} 10849 found by Products search, approved card A`)
    await loadPhoto(real)
    checkPhotoBadge(await photoBadge(real), tag, "10849:", locale === "ar")
    const realPrice = await real.locator(".product-card__price").evaluate((el, rtl) => {
      const current = el.querySelector(".product-card__current-price"), s = el.querySelector(".product-price__original s")
      const c = current.getBoundingClientRect(), o = s.getBoundingClientRect(), muted = getComputedStyle(s).color !== getComputedStyle(current).color
      return { current: current.innerText, original: s.innerText, first: rtl ? c.left > o.left : c.left < o.left, struck: getComputedStyle(s).textDecorationLine === "line-through", smaller: parseFloat(getComputedStyle(s).fontSize) < parseFloat(getComputedStyle(current).fontSize), muted }
    }, locale === "ar")
    check(/1,100/.test(realPrice.current) && !/1,500/.test(realPrice.current) && /1,500/.test(realPrice.original), `${tag} 10849 current EGP 1,100 and original EGP 1,500`)
    check(realPrice.first && realPrice.struck && realPrice.smaller && realPrice.muted, `${tag} 10849 current price first; original smaller, muted, struck through`)
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag} search listing no overflow`)
    // Home offers the newest discounted products, so it shows the live-shaped 10849 rather than 20.
    for (const [route, id] of [["/men-perfumes", 20], ["/", 10849]]) {
      await p.goto(base + prefix + route, { waitUntil: "networkidle" })
      check(await card(p, id).locator(".product-sale-badge").count() === 1 && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag} ${route} sale reuse/no overflow`)
    }
    const pdpBlock = () => p.locator(".pdp__price").evaluate((el, rtl) => {
      const badge = el.querySelector(".product-sale-badge").getBoundingClientRect(), c = el.querySelector(".product-card__current-price").getBoundingClientRect(), o = el.querySelector(".product-price__original").getBoundingClientRect()
      return { gap: c.top - badge.bottom, order: rtl ? c.left > o.left : c.left < o.left, oneLine: o.top < c.bottom - 4 && o.bottom > c.top + 4 }
    }, locale === "ar")
    await p.goto(base + prefix + "/products/product-20", { waitUntil: "networkidle" })
    const pdp = await pdpBlock()
    check(pdp.gap >= 6 && pdp.gap <= 12, `${tag} PDP percentage ${pdp.gap.toFixed(1)}px above the prices`)
    check(pdp.order && pdp.oneLine, `${tag} PDP current price first, original beside it`)
    check(await p.locator(".pdp__price .product-sale-badge").count() === 1 && await p.locator(".pdp__price .product-sale-badge").innerText() === "−27%" && await p.locator(".pdp-gallery .product-sale-badge").count() === 0, `${tag} PDP percentage is the only badge, none on the image`)
    const pdpSpoken = (await p.locator(".pdp__price").evaluate(el => { const c = el.cloneNode(true); c.querySelectorAll("[aria-hidden=true]").forEach(n => n.remove()); return c.textContent })).replace(/\s+/g, " ")
    check(pdpSpoken.includes(locale === "ar" ? "السعر بعد الخصم" : "Sale price") && !pdpSpoken.includes("%"), `${tag} PDP spoken prices labelled, percentage not repeated`)
    await p.goto(base + prefix + "/products/product-19", { waitUntil: "networkidle" })
    check(await p.locator(".pdp__price .product-sale-badge, .pdp__price s").count() === 0, `${tag} normal PDP has no sale UI`)
    await p.goto(base + prefix + "/products/product-21", { waitUntil: "networkidle" })
    check(await p.locator(".pdp__price .product-sale-badge, .pdp__price s").count() === 0, `${tag} unselected range has no guessed discount`)
    const options = p.locator("input[data-product-option]")
    await options.nth(0).check()
    check(await p.locator(".pdp__price .product-sale-badge").innerText() === "−18%" && await p.locator(".pdp__price s").count() === 1, `${tag} selected discounted option`)
    const optionBlock = await pdpBlock()
    check(optionBlock.gap >= 6 && optionBlock.gap <= 12 && optionBlock.order, `${tag} selected option uses the two-level block`)
    await options.nth(1).check()
    check(await p.locator(".pdp__price .product-sale-badge, .pdp__price s").count() === 0, `${tag} changing option removes stale sale`)
    await options.nth(0).check()
    check(await p.locator(".pdp__price .product-sale-badge").innerText() === "−18%", `${tag} switching back restores correct percentage`)
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag} PDP no overflow`)
    check(errors.length === 0, `${tag} no uncaught errors`)
    await p.close()
  }
  fs.writeFileSync(new URL("normal-comparisons.json", out), JSON.stringify(comparisons, null, 2))
  console.log(`${checks} sale UI checks passed; no remote writes`)
} finally { await browser.close() }
