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
    product(26, { price_before_discount: 900 })]
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
    check(await sale.locator(".product-card__sale-label").innerText() === (locale === "ar" ? "خصم" : "SALE"), `${tag} localized sale`)
    check(await sale.locator(".product-card__sale-percent").innerText() === "−27%", `${tag} percentage`)
    check(await sale.locator(".product-price--sale > span").first().getAttribute("class") === "product-card__current-price" && await sale.locator("s").count() === 1, `${tag} selling price first, original struck through`)
    const geometry = await sale.evaluate(el => {
      const stage = el.querySelector(".product-card__stage").getBoundingClientRect(), heart = el.querySelector(".product-card__wishlist").getBoundingClientRect()
      const badges = [...el.querySelectorAll(".product-sale-badge")].map(b => b.getBoundingClientRect())
      const overlap = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
      return badges.every(b => b.left >= stage.left && b.right <= stage.right && b.top >= stage.top && b.bottom <= stage.bottom && !overlap(b, heart)) && !overlap(...badges)
    })
    check(geometry, `${tag} badges inside image area and clear of heart/each other`)
    const mirrored = await sale.evaluate((el, rtl) => {
      const stage = el.querySelector(".product-card__stage").getBoundingClientRect()
      const label = el.querySelector(".product-card__sale-label").getBoundingClientRect()
      const percent = el.querySelector(".product-card__sale-percent").getBoundingClientRect()
      const heart = el.querySelector(".product-card__wishlist").getBoundingClientRect()
      const leading = (r) => rtl ? stage.right - r.right : r.left - stage.left
      const trailing = (r) => rtl ? r.left - stage.left : stage.right - r.right
      const near = (value, expected) => Math.abs(value - expected) < 1
      const facts = { leading: leading(label), trailing: trailing(percent), labelTop: label.top - stage.top, percentTop: percent.top, heartBottom: heart.bottom, heartTrailing: trailing(heart), stage: stage.width }
      return { ok: near(facts.leading, 12) && near(facts.trailing, 12) && near(facts.labelTop, 12) &&
        facts.percentTop >= facts.heartBottom && facts.heartTrailing < stage.width / 2, facts }
    }, locale === "ar")
    if (!mirrored.ok) console.log(`INFO ${tag} badge geometry`, JSON.stringify(mirrored.facts))
    check(mirrored.ok, `${tag} sale label leads and percentage sits under the heart, mirrored for the language`)
    const pair = await sale.evaluate(el => {
      const current = el.querySelector(".product-card__current-price").getBoundingClientRect()
      const original = el.querySelector(".product-price__original").getBoundingClientRect()
      return original.top < current.bottom - 4 && original.bottom > current.top + 4
    })
    check(pair, `${tag} current and original price share one line`)
    const hits = await sale.evaluate(el => {
      el.querySelector(".product-card__stage").scrollIntoView({ block: "center", behavior: "instant" })
      const heart = el.querySelector(".product-card__wishlist")
      const r = heart.getBoundingClientRect()
      const mx = r.left + r.width / 2, my = r.top + r.height / 2
      const points = [[mx, my], [r.left + 2, my], [r.right - 2, my], [mx, r.top + 2], [mx, r.bottom - 2]]
      const label = el.querySelector(".product-card__sale-label").getBoundingClientRect()
      return {
        heart: points.every(([x, y]) => heart.contains(document.elementFromPoint(x, y))) && r.width >= 40 && r.height >= 40,
        through: !!document.elementFromPoint(label.left + label.width / 2, label.top + label.height / 2)?.closest(".product-card__image-link"),
      }
    })
    check(hits.heart, `${tag} full 40px heart target stays clickable`)
    check(hits.through, `${tag} badges never block the image link`)
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
    for (const route of ["/men-perfumes", "/"]) {
      await p.goto(base + prefix + route, { waitUntil: "networkidle" })
      check(await card(p, 20).locator(".product-card__sale-label").count() === 1 && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag} ${route} sale reuse/no overflow`)
    }
    await p.goto(base + prefix + "/products/product-21", { waitUntil: "networkidle" })
    check(await p.locator(".pdp__price .product-sale-badge, .pdp__price s").count() === 0, `${tag} unselected range has no guessed discount`)
    const options = p.locator("input[data-product-option]")
    await options.nth(0).check()
    check(await p.locator(".pdp__price .product-sale-badge").innerText() === "−18%" && await p.locator(".pdp__price s").count() === 1, `${tag} selected discounted option`)
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
