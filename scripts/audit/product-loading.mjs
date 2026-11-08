// Product-card loading state as the visitor sees it, on a local live-mode build.
// Every company and Supabase response is a fixture, held for a chosen delay;
// anything else leaving the browser is aborted. Checks what is PAINTED (opacity,
// contrast against the page, position in view), not merely what is mounted:
// - Home offers and /products show visible card skeletons while data is pending
//   (500 ms, 1.5 s, 3 s), in EN and AR, at 1440 and 390;
// - the image placeholder is a plain block (no bottle, shadow, sheen or image);
// - every bar is painted (background-image, background-size height, box,
//   effective opacity), inside its card, in reading order, from the inline start;
// - real cards replace them, nothing waits on the skeleton, no endless state;
// - products ready at once (instant answer, same-tab reload from the saved
//   catalogue, in-app navigation) never paint a skeleton;
// - Retry after a failed full load shows the skeleton while it retries;
// - the swap barely moves the layout.
//
// Build: npx vite build --outDir scripts/audit/output/loading-build
// Serve: npx vite preview --outDir scripts/audit/output/loading-build --port 18570 --strictPort
// Run:   node scripts/audit/product-loading.mjs   (LOADING_AUDIT_URL overrides the address)
import assert from "node:assert/strict"
import { launch } from "./lib.mjs"

const base = (process.env.LOADING_AUDIT_URL || "http://127.0.0.1:18570").replace(/\/$/, "")
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "local builds only")
const browser = await launch()
let checks = 0
const failures = []
const check = (ok, label) => {
  checks++
  if (ok) console.log(`PASS ${label}`)
  else {
    failures.push(label)
    console.log(`FAIL ${label}`)
  }
}

/** 24 products: the newest 20 are the first page; the 4 oldest are discounted (Home offers). */
function fixtures(origin) {
  const image = `${origin}/images/packshots/velvet-iris.webp`
  const names = ["Amber Night", "A considerably longer fragrance name that wraps", "Iris", "Oud Reserve"]
  return Array.from({ length: 24 }, (_, index) => {
    const id = 100 + index
    return {
      id, product_type: index % 2 ? 1344 : 1382, name: `${names[index % 4]} ${id}`, description: "100ml", image,
      price_after_discount: 1100, is_available: true, is_variation_available: false,
      ...(index < 4 ? { price_before_discount: 1500 } : {}),
    }
  })
}

/** A page whose company API answers after `delay` ms; the full list after `fullDelay`; `failFull()` aborts it. */
async function pageAt(width, { delay = 0, fullDelay = delay, failFull = () => false, context, follow } = {}) {
  const ctx = context ?? (await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 } }))
  const page = await ctx.newPage()
  const products = fixtures(base)
  const newest = [...products].sort((a, b) => b.id - a.id)
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === new URL(base).origin) return route.continue()
    if (url.hostname === "api.welpstar.com") {
      if (route.request().method() !== "GET") return route.abort()
      const full = url.pathname.endsWith("all-products")
      if (full && failFull()) return route.abort("internetdisconnected")
      const wait = full ? fullDelay : delay
      if (wait) await new Promise((r) => setTimeout(r, wait))
      const json = full ? { data: [{ name: "All", products }] }
        : url.pathname.endsWith("/products") ? { count: products.length, results: newest.slice(0, 20) }
        : { data: products.find((p) => p.id === Number(url.pathname.split("/").pop())) }
      return route.fulfill({ json }).catch(() => {})
    }
    if (/\/rest\/v1\/product_(metadata|gallery)/.test(url.pathname)) return route.fulfill({ json: [] })
    return route.abort()
  })
  // Per animation frame: is a skeleton painted (opacity > 0.05, in view)? When did cards come?
  await page.addInitScript((follow) => {
    const record = (window.__loading = { painted: 0, firstPainted: null, cardsAt: null, mostShown: 0, shifts: [] })
    let followed = false
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) record.shifts.push({ t: entry.startTime, v: entry.value })
    }).observe({ type: "layout-shift", buffered: true })
    const tick = () => {
      // Bring the product area into view the moment it exists, as a visitor scrolling to it would.
      const area = follow && document.querySelector(follow)
      if (area && !followed) {
        followed = true
        area.scrollIntoView({ block: "start", behavior: "instant" })
      }
      const shown = [...document.querySelectorAll(".product-skeleton")].filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.bottom > 0 && r.top < innerHeight && Number(getComputedStyle(el).opacity) > 0.95 && getComputedStyle(el).visibility !== "hidden"
      }).length
      record.mostShown = Math.max(record.mostShown, shown)
      if (shown) {
        record.painted++
        record.firstPainted ??= performance.now()
      }
      if (record.cardsAt === null && document.querySelector(".offers .product-card, .catalogue .product-card")) record.cardsAt = performance.now()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, follow)
  return page
}
const scopeOf = (route) => (route.endsWith("/products") ? ".catalogue" : ".offers")

/** Relative luminance difference between the skeleton image block and the page. */
const contrastProbe = (scope) => {
  const lum = (css) => {
    const [r, g, b] = css.match(/[\d.]+/g).slice(0, 3).map(Number).map((c) => {
      c /= 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const image = document.querySelector(`${scope} .product-skeleton__image`)
  const line = document.querySelector(`${scope} .product-skeleton__line`)
  const page = lum(getComputedStyle(document.body).backgroundColor)
  const block = lum(getComputedStyle(image).backgroundColor)
  const bar = getComputedStyle(line).backgroundImage.match(/rgba?\([^)]*\)/)
  const s = getComputedStyle(image)
  return {
    image: (page - block) / page,
    line: bar ? (page - lum(bar[0])) / page : 0,
    children: image.children.length,
    pseudo: ["::before", "::after"].map((p) => getComputedStyle(image, p).content).filter((c) => c && c !== "none" && c !== "normal").length,
    imageLike: /gradient|url\(/.test(s.backgroundImage) || !!document.querySelector(`${scope} .product-skeleton img, ${scope} .product-skeleton svg, .product-skeleton__bottle`),
  }
}

/**
 * What the first in-view skeleton card actually paints. The bars are a
 * background-image gradient (not background-color), so each bar's painted
 * height is the smaller of its background-size height and its own box.
 */
const paintProbe = (scope) => {
  const card = [...document.querySelectorAll(`${scope} .product-skeleton`)].find((el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && getComputedStyle(el).visibility !== "hidden"
  })
  const cardBox = card.getBoundingClientRect()
  const opacityOf = (el) => {
    let o = 1
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) o *= Number(getComputedStyle(n).opacity)
    return o
  }
  const bar = (el) => {
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const size = s.backgroundSize.split(/\s+/)
    const sizeW = size[0].endsWith("%") ? (r.width * parseFloat(size[0])) / 100 : parseFloat(size[0])
    const sizeH = parseFloat(size[1])
    const h = Math.min(sizeH, r.height)
    const top = r.top + (r.height - h) / 2 // centred in its line box
    return {
      image: s.backgroundImage, size: s.backgroundSize, w: Math.min(sizeW, r.width), h, top, bottom: top + h,
      left: r.left, right: r.right, opacity: opacityOf(el),
      inCard: r.left >= cardBox.left - 0.5 && r.right <= cardBox.right + 0.5 && top >= cardBox.top - 0.5 && top + h <= cardBox.bottom + 0.5,
    }
  }
  const image = card.querySelector(".product-skeleton__image")
  const imageBox = image.getBoundingClientRect()
  const names = [...card.querySelectorAll(".product-skeleton__name")].flatMap((n) =>
    n.classList.contains("product-skeleton__line") ? [n] : [...n.querySelectorAll(".product-skeleton__line")])
  const pick = (sel) => card.querySelector(sel)
  return {
    rtl: getComputedStyle(card).direction === "rtl",
    cardW: cardBox.width,
    image: { h: imageBox.height, w: imageBox.width, bottom: imageBox.bottom, opacity: opacityOf(image), bg: getComputedStyle(image).backgroundColor },
    names: names.map(bar),
    notes: pick(".product-skeleton__notes") && bar(pick(".product-skeleton__notes")),
    price: pick(".product-skeleton__price") && bar(pick(".product-skeleton__price")),
    action: pick(".product-skeleton__action") && bar(pick(".product-skeleton__action")),
    hScroll: document.documentElement.scrollWidth - innerWidth,
  }
}

/** Checks on paintProbe: every bar painted, readable, inside its card, in reading order, from the inline start. */
function checkPaint(c, tag, packshot) {
  const bars = [...c.names, c.notes, c.price, c.action].filter(Boolean)
  check(c.image.h > 40 && c.image.w > 40 && c.image.opacity >= 0.8, `${tag} image placeholder painted (${Math.round(c.image.w)}x${Math.round(c.image.h)}, opacity ${c.image.opacity.toFixed(2)})`)
  check(bars.every((b) => b.image !== "none" && /gradient/.test(b.image)), `${tag} every bar has a painted background-image`)
  check(bars.every((b) => b.w > 0 && b.h > 0 && b.opacity >= 0.8), `${tag} every bar non-zero and visible (min opacity ${Math.min(...bars.map((b) => b.opacity)).toFixed(2)})`)
  check(bars.every((b) => b.inCard && b.top >= c.image.bottom - 0.5), `${tag} every bar inside the card, below the image`)
  check(c.names.length === (packshot ? 2 : 1) && c.names.every((b) => b.h >= 10), `${tag} title ${c.names.length} line(s), ${c.names.map((b) => b.h.toFixed(1)).join("/")}px`)
  if (packshot) check(c.names[0].w > c.names[1].w * 1.3 && c.names[0].w < c.cardW * 0.85, `${tag} title line 2 shorter than line 1 (${Math.round(c.names[0].w)} / ${Math.round(c.names[1].w)} px)`)
  check(c.notes.h >= 9, `${tag} detail line ${c.notes.h.toFixed(1)}px`)
  check(c.price.h >= 12, `${tag} price ${c.price.h.toFixed(1)}px`)
  if (packshot) check(c.action.h >= 11, `${tag} action ${c.action.h.toFixed(1)}px`)
  const order = [...c.names, c.notes, c.price]
  check(order.every((b, i) => i === 0 || b.top >= order[i - 1].bottom - 0.5), `${tag} bars in reading order, none overlapping`)
  const start = (b) => (c.rtl ? b.right : b.left)
  check(bars.filter((b) => b !== c.action).every((b) => Math.abs(start(b) - start(c.names[0])) < 1), `${tag} bars start at the ${c.rtl ? "right" : "left"} edge`)
  check(c.hScroll <= 0, `${tag} no horizontal scroll (${c.hScroll}px)`)
}

try {
  // Warm-up: the first page of a fresh browser mounts late, which would hide a short delay entirely.
  {
    const warm = await pageAt(1440)
    await warm.goto(base + "/products", { waitUntil: "load" })
    await warm.locator(".catalogue .product-card").first().waitFor({ timeout: 15000 })
    await warm.context().close()
  }

  // 1. Genuinely pending: the skeleton is painted where the cards will be, then replaced.
  for (const prefix of ["", "/ar"]) for (const width of [1440, 390]) for (const route of ["/", "/products"]) {
    for (const delay of [500, 1500, 3000]) {
      // Home offers come from the full catalogue; the first page is ready at once there.
      const timing = route === "/" ? { delay: 0, fullDelay: delay } : { delay, fullDelay: delay + 1500 }
      if (width === 390 && delay === 3000) continue // 3 s covered at 1440; keeps the run short
      const tag = `${prefix || "/en"} ${width} ${route} ${delay}ms`
      const scope = scopeOf(route)
      const p = await pageAt(width, { ...timing, follow: scope })
      await p.goto(base + prefix + route, { waitUntil: "commit" })
      await p.locator(`${scope} .product-skeleton`).first().waitFor({ timeout: 10000 })
      await p.waitForTimeout(250)
      if (delay >= 1500) {
        check((await p.locator(`${scope} .product-card`).count()) === 0, `${tag} still pending at the check`)
        const c = await p.evaluate(contrastProbe, scope)
        check(c.image >= 0.07 && c.line >= 0.1, `${tag} skeleton distinct from the page (image ${(c.image * 100).toFixed(1)}%, bars ${(c.line * 100).toFixed(1)}%)`)
        check(c.children === 0 && c.pseudo === 0 && !c.imageLike, `${tag} image placeholder is a plain block`)
        checkPaint(await p.evaluate(paintProbe, scope), tag, route.endsWith("/products"))
        const box = await p.locator(`${scope} .product-skeleton`).first().evaluate((el) => {
          const image = el.querySelector(".product-skeleton__image").getBoundingClientRect()
          const grid = el.closest("ul, .product-grid").getBoundingClientRect()
          return { w: el.getBoundingClientRect().width, imageH: image.height, gridTop: grid.top + scrollY }
        })
        const shiftsFrom = await p.evaluate(() => performance.now())
        await p.locator(`${scope} .product-card`).first().waitFor({ timeout: delay + 15000 })
        const real = await p.locator(`${scope} .product-card`).first().evaluate((el) => {
          const image = el.querySelector(".product-card__stage, .product-card__media").getBoundingClientRect()
          const grid = el.closest("ul, .product-grid").getBoundingClientRect()
          return { w: el.getBoundingClientRect().width, imageH: image.height, gridTop: grid.top + scrollY }
        })
        check(Math.abs(real.w - box.w) < 1 && Math.abs(real.imageH - box.imageH) < 1 && Math.abs(real.gridTop - box.gridTop) < 1,
          `${tag} card width, image area and grid position unchanged by the swap`)
        await p.waitForTimeout(400)
        const shift = (await p.evaluate(() => window.__loading)).shifts.filter((s) => s.t >= shiftsFrom).reduce((sum, s) => sum + s.v, 0)
        check(shift < 0.02, `${tag} layout shift at the swap ${shift.toFixed(4)}`)
      }
      await p.locator(`${scope} .product-card`).first().waitFor({ timeout: delay + 15000 })
      await p.waitForTimeout(100)
      const r = await p.evaluate(() => window.__loading)
      check(r.mostShown >= (width > 500 ? 4 : 1), `${tag} skeleton cards painted in view (${r.mostShown} at once)`)
      // The request is held from page start; the page mounts a few hundred ms later.
      const visibleFor = Math.round(r.cardsAt - r.firstPainted)
      check(r.firstPainted !== null && visibleFor >= delay - 700, `${tag} skeleton visible until the cards arrive (${visibleFor} ms)`)
      check((await p.locator(`${scope} .product-skeleton`).count()) === 0, `${tag} no skeleton left after the cards arrive`)
      check((await p.locator(`${scope} .product-card`).count()) >= 4, `${tag} real product cards shown`)
      await p.close()
    }
  }

  // 2. Ready at once: an instant answer, a same-tab reload from the saved catalogue, in-app navigation.
  for (const prefix of ["", "/ar"]) for (const route of ["/products", "/"]) {
    const tag = `${prefix || "/en"} ${route}`
    const scope = scopeOf(route)
    const p = await pageAt(1440, { delay: 0 })
    await p.goto(base + prefix + route, { waitUntil: "load" })
    await p.locator(`${scope} .product-card`).first().waitFor({ timeout: 10000 })
    await p.waitForTimeout(800)
    // The full catalogue is saved for this tab now: a reload has it at once.
    await p.reload({ waitUntil: "load" })
    await p.locator(`${scope} .product-card`).first().waitFor({ timeout: 10000 })
    await p.waitForTimeout(400)
    check((await p.evaluate(() => window.__loading.painted)) === 0, `${tag} same-tab reload with the saved catalogue: real cards, no skeleton painted`)
    const other = route === "/" ? `a[href="${prefix}/products"]` : prefix ? `a[href="${prefix}"], a[href="${prefix}/"]` : `a[href="/"]`
    await p.evaluate(() => (window.__loading.painted = 0))
    await p.locator(other).first().evaluate((el) => el.click())
    await p.locator(`${scopeOf(route === "/" ? "/products" : "/")} .product-card`).first().waitFor({ timeout: 5000 })
    await p.waitForTimeout(300)
    check((await p.evaluate(() => window.__loading.painted)) === 0, `${tag} in-app navigation: real cards, no skeleton painted`)
    await p.close()
  }
  {
    // Answer at once on a fresh tab: /products should not paint a skeleton the visitor cannot use.
    const p = await pageAt(1440, { delay: 0, fullDelay: 0 })
    await p.goto(base + "/products", { waitUntil: "load" })
    await p.locator(".catalogue .product-card").first().waitFor({ timeout: 10000 })
    await p.waitForTimeout(300)
    const r = await p.evaluate(() => window.__loading)
    check(r.painted <= 2, `instant answer: at most a stray frame of skeleton (${r.painted} frames)`)
    check(!(await p.locator(".catalogue__grid--reveal").count()) || r.painted > 0, "instant answer: real cards with no fade-in")
    await p.close()
  }

  // 3. Retry after a failed full load: the skeleton returns while it retries, then the cards.
  {
    let down = true
    const p = await pageAt(1440, { delay: 0, fullDelay: 1500, failFull: () => down })
    await p.goto(base + "/products?sort=price-asc", { waitUntil: "load" })
    const retry = p.getByRole("button", { name: /Retry|Try again/i })
    await retry.first().waitFor({ timeout: 10000 })
    check(true, "failed full load shows Retry")
    down = false
    await retry.first().click()
    await p.waitForTimeout(400)
    const painted = await p.locator(".catalogue .product-skeleton").first().evaluate((el) => Number(getComputedStyle(el).opacity))
    check(painted > 0.95, "retrying: skeleton visible")
    await p.locator(".catalogue .product-card").first().waitFor({ timeout: 15000 })
    check((await p.locator(".catalogue .product-skeleton").count()) === 0, "retry: cards replace the skeleton")
    await p.close()
  }
} finally {
  await browser.close()
}
console.log(`\n${checks - failures.length}/${checks} checks passed`)
if (failures.length) {
  console.log("Failed:\n  " + failures.join("\n  "))
  process.exit(1)
}
