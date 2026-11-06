// Product-card and option UX on a local live-mode build. Every company and
// Supabase response is a fixture; anything else leaving the browser is aborted.
// Covers: Home card alignment, Products sale UI, skeletons (shape, no product
// silhouette, cache), Choose options CTA, required-option guidance/validation.
import assert from "node:assert/strict"
import { launch, WIDTHS } from "./lib.mjs"

const base = process.env.HYBRID_AUDIT_URL || "http://127.0.0.1:18560"
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname))
const browser = await launch()
let checks = 0
const check = (ok, label) => { assert.ok(ok, label); checks++; console.log(`PASS ${label}`) }

function fixtures(origin) {
  const image = `${origin}/images/packshots/velvet-iris.webp`
  const product = (id, extra = {}) => ({ id, product_type: 1344, name: `Scent ${id}`, description: "", image,
    price_after_discount: 1100, is_available: true, is_variation_available: false, ...extra })
  return [
    // Home offers: discounted, with and without a details line, short and long names.
    product(30, { name: "Short", price_before_discount: 1500 }),
    product(31, { name: "With Size", description: "100ml", price_before_discount: 1500 }),
    product(32, { name: "A considerably longer discounted fragrance name that wraps", price_before_discount: 1500 }),
    product(33, { name: "Fourth Offer", price_before_discount: 1500 }),
    // Not discounted, and a box / no-box product that needs a choice.
    product(34, { name: "Plain Scent", description: "100ml" }),
    product(35, { name: "Boxed Choice", is_variation_available: true, variations: [{ id: 4800, name: "Choose", is_required: true, is_main_price: true, options: [
      { id: 12203, name: "Without box", price_before_discount: null, price_after_discount: 900 },
      { id: 12202, name: "With box", price_before_discount: null, price_after_discount: 1100 },
    ] }] }),
  ]
}

/** A page whose company API answers after `delay` ms (0 = at once); `fail` aborts it. */
async function pageAt(width, { delay = 0, fail = () => false } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" })
  const products = fixtures(base)
  await page.route("**/*", async route => {
    const url = new URL(route.request().url())
    if (url.origin === new URL(base).origin) return route.continue()
    if (url.hostname === "api.welpstar.com") {
      if (route.request().method() !== "GET") return route.abort()
      if (fail()) return route.abort("internetdisconnected")
      if (delay) await new Promise(r => setTimeout(r, url.pathname.endsWith("all-products") ? delay * 2 : delay))
      const json = url.pathname.endsWith("all-products") ? { data: [{ name: "Men", products }] }
        : url.pathname.endsWith("products") ? { count: products.length, results: products }
        : { data: products.find(p => p.id === Number(url.pathname.split("/").pop())) }
      return route.fulfill({ json })
    }
    if (/\/rest\/v1\/product_(metadata|gallery)/.test(url.pathname)) return route.fulfill({ json: [] })
    return route.abort()
  })
  return page
}
const card = (page, id) => page.locator(".product-card").filter({ has: page.locator(`a.product-card__link[href$="/product-${id}"]`) })

try {
  // 1. Home: price rows line up whatever the name length or details line.
  for (const width of WIDTHS) for (const prefix of ["", "/ar"]) {
    const tag = `${prefix || "/en"} ${width}`
    const p = await pageAt(width)
    await p.goto(base + prefix + "/", { waitUntil: "networkidle" })
    await p.locator(".offers .product-card").first().waitFor()
    const cards = await p.$$eval(".offers .product-card", els => els.map(el => ({
      price: el.querySelector(".product-card__price").getBoundingClientRect().top,
      top: el.getBoundingClientRect().top,
      details: el.querySelector(".product-card__info p")?.textContent ?? null,
      clipped: [...el.querySelectorAll("h3, p")].some(n => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1),
    })))
    check(cards.length === 4, `${tag} four offer cards`)
    check(cards.every(c => Math.abs(c.price - cards[0].price) < 1 && Math.abs(c.top - cards[0].top) < 1), `${tag} Home price rows aligned (${cards.map(c => Math.round(c.price)).join(",")})`)
    check(cards.filter(c => c.details === null).length === 3 && cards.some(c => /100/.test(c.details ?? "")), `${tag} details shown only when real, no placeholder text`)
    check(cards.every(c => !c.clipped), `${tag} no clipped name or details`)
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag} Home no horizontal overflow`)
    await p.close()
  }

  // 2. Products: discounted card has the approved sale UI; CTA wording per product.
  for (const width of [1440, 390]) for (const prefix of ["", "/ar"]) {
    const tag = `${prefix || "/en"} ${width}`
    const p = await pageAt(width)
    await p.goto(base + prefix + "/products", { waitUntil: "networkidle" })
    const sale = card(p, 31)
    check(await sale.locator(".product-card__stage .product-sale-badge").innerText() === "−27%", `${tag} Products sale card shows −27% on the image`)
    check(await sale.locator(".product-price--sale > span").first().getAttribute("class") === "product-card__current-price" && /1,500/.test(await sale.locator(".product-price__original s").innerText()), `${tag} Products current price first, original struck`)
    check(await card(p, 34).locator(".product-sale-badge, s").count() === 0, `${tag} non-discounted card has no sale UI`)
    const choose = card(p, 35).locator(".product-card__add-link")
    check(await choose.evaluate(el => el.tagName) === "A" && (prefix ? /اختر الخيارات/ : /^Choose options$/).test((await choose.innerText()).trim()), `${tag} option product says Choose options`)
    check(await card(p, 35).locator("button.product-card__add-link").count() === 0, `${tag} no direct Add to Bag on option product`)
    check(await card(p, 34).locator("button.product-card__add-link").count() === 1, `${tag} plain product keeps Add to Bag`)
    await choose.click()
    await p.waitForURL(/\/products\/product-35$/)
    await p.locator("input[data-product-option]").first().waitFor()
    await p.waitForTimeout(400)
    check(await p.locator(".pdp__option [role=alert]").count() === 0, `${tag} arriving from the card shows guidance, not an error`)
    check(await p.evaluate(() => document.activeElement?.matches("input[data-product-option]")), `${tag} arriving from the card focuses the choice`)
    await p.close()
  }

  // 3. Product Details: guidance, inline validation, clearing, add.
  for (const width of [1440, 390]) for (const prefix of ["", "/ar"]) {
    const tag = `${prefix || "/en"} ${width}`
    const p = await pageAt(width)
    const errors = []
    p.on("pageerror", e => errors.push(e.message))
    await p.goto(base + prefix + "/products/product-35", { waitUntil: "networkidle" })
    const group = p.locator("fieldset:has(input[data-product-option])")
    const hint = group.locator(".pdp__option-message")
    check(await hint.isVisible() && (await hint.innerText()).trim() === (prefix ? "يُرجى اختيار أحد الخيارات" : "Choose an option"), `${tag} quiet helper under the choice`)
    check(await group.getAttribute("aria-describedby") === await hint.getAttribute("id"), `${tag} helper linked to the group`)
    check(await hint.getAttribute("role") === null, `${tag} helper is not an alert`)
    const bagBefore = await p.locator(".header-actions a[href$='/cart']").innerText()
    // Scroll the choice away so the error has to bring it back.
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await p.locator(".pdp__add").evaluate(el => el.click())
    await p.waitForTimeout(700)
    const alert = group.locator("[role=alert]")
    const message = prefix ? "من فضلك اختاري أحد الخيارات قبل إضافة المنتج إلى الحقيبة." : "Please select an option before adding this item to your bag."
    check(await alert.count() === 1 && (await alert.innerText()).trim() === message, `${tag} inline error inside the option group`)
    check(await p.locator("input[data-product-option][aria-invalid=true]").count() === 2, `${tag} options marked aria-invalid`)
    check(await group.getAttribute("aria-describedby") === await alert.getAttribute("id"), `${tag} error linked with aria-describedby`)
    check(await p.evaluate(() => document.activeElement?.matches("input[data-product-option]")), `${tag} focus moved to the choice`)
    check(await group.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight }), `${tag} choice scrolled into view`)
    check(await p.locator(".header-actions a[href$='/cart']").innerText() === bagBefore, `${tag} nothing added without a choice`)
    await p.locator(".pdp__add").click()
    await p.locator(".pdp__add").click()
    check(await p.locator("[role=alert]").filter({ hasText: message }).count() === 1, `${tag} repeated clicks do not duplicate the message`)
    // Keyboard: arrow keys choose within the focused group.
    await p.locator("input[data-product-option]").first().focus()
    await p.keyboard.press(prefix ? "ArrowLeft" : "ArrowRight")
    await p.keyboard.press(prefix ? "ArrowRight" : "ArrowLeft")
    check(await p.locator("input[data-product-option]:checked").count() === 1, `${tag} keyboard selects an option`)
    check(await group.locator("[role=alert]").count() === 0 && await p.locator("input[data-product-option][aria-invalid]").count() === 0, `${tag} error clears on selection`)
    check(await hint.evaluate(el => getComputedStyle(el).visibility) === "hidden", `${tag} helper settles without moving the page`)
    check(/900/.test(await p.locator(".pdp__price").innerText()), `${tag} selected option price shown`)
    await p.locator(".pdp__add").click()
    await p.waitForTimeout(300)
    check(await p.locator(".header-actions a[href$='/cart']").innerText() !== bagBefore, `${tag} Add to Bag works after the choice`)
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag} PDP no overflow`)
    check(errors.length === 0, `${tag} no uncaught errors`)
    await p.close()
  }

  // 4. Skeletons: shown while pending on an uncached load, same system, no silhouette, real cards replace them.
  for (const prefix of ["", "/ar"]) for (const width of [1440, 390]) {
    const tag = `${prefix || "/en"} ${width}`
    for (const route of ["/", "/products"]) {
      const p = await pageAt(width, { delay: 1500 })
      await p.goto(base + prefix + route, { waitUntil: "commit" })
      const scope = route === "/" ? ".offers" : ".catalogue"
      await p.locator(`${scope} .product-skeleton`).first().waitFor({ timeout: 10000 })
      const sk = await p.$$eval(`${scope} .product-skeleton`, els => els.map(el => {
        const image = el.querySelector(".product-skeleton__image")
        const s = getComputedStyle(image), after = getComputedStyle(image, "::after"), before = getComputedStyle(image, "::before")
        return {
          children: image.children.length,
          pseudo: [after.content, before.content].filter(c => c && c !== "none" && c !== "normal").length,
          gradient: /gradient|url\(/.test(s.backgroundImage),
          shape: el.dataset ? el.className : "",
          box: el.getBoundingClientRect().width,
        }
      }))
      check(sk.length > 0, `${tag} ${route} skeleton while pending`)
      check(sk.every(s => s.children === 0 && s.pseudo === 0 && !s.gradient), `${tag} ${route} image area is empty (no bottle, shadow or sheen)`)
      check(await p.locator(".product-skeleton__bottle").count() === 0, `${tag} ${route} no bottle element`)
      check(sk.every(s => (route === "/") === /product-skeleton--editorial/.test(s.shape)), `${tag} ${route} skeleton shape matches its card`)
      const before = await p.locator(scope === ".offers" ? ".offers" : ".catalogue").evaluate(el => el.getBoundingClientRect().height)
      const firstBox = await p.locator(`${scope} .product-skeleton`).first().evaluate(el => [el.getBoundingClientRect().width, el.getBoundingClientRect().height])
      await p.locator(`${scope} .product-card`).first().waitFor({ timeout: 15000 })
      await p.waitForTimeout(300)
      check(await p.locator(`${scope} .product-skeleton`).count() === 0, `${tag} ${route} cards replace the skeleton`)
      const cardBox = await p.locator(`${scope} .product-card`).first().evaluate(el => [el.getBoundingClientRect().width, el.getBoundingClientRect().height])
      check(Math.abs(cardBox[0] - firstBox[0]) < 1, `${tag} ${route} skeleton width matches the card`)
      if (route === "/") {
        const after = await p.locator(".offers").evaluate(el => el.getBoundingClientRect().height)
        // The skeleton holds one-line names; a fixture name that wraps may add at most that one line.
        const nameLine = 22 * 1.2 + 1
        check(after >= before - 1 && after - before <= nameLine && cardBox[1] - firstBox[1] <= nameLine, `${tag} Home offers grow at most one name line (${Math.round(before)} -> ${Math.round(after)})`)
      }
      // Cached in-app navigation: real cards straight away.
      const target = route === "/" ? `a[href="${prefix}/products"]` : prefix ? `a[href="${prefix}"], a[href="${prefix}/"]` : `a[href="/"]`
      await p.locator(target).first().evaluate(el => el.click())
      await p.waitForTimeout(150)
      const other = route === "/" ? ".catalogue" : ".offers"
      check(await p.locator(`${other} .product-skeleton`).count() === 0 && await p.locator(`${other} .product-card`).count() > 0, `${tag} ${route} cached navigation shows real cards, no skeleton flash`)
      await p.close()
    }
  }

  // 5. Unavailable catalogue: no endless skeleton, Retry recovers.
  {
    let down = true
    const p = await pageAt(1440, { fail: () => down })
    await p.goto(base + "/products", { waitUntil: "networkidle" })
    await p.waitForTimeout(1500)
    const retry = p.getByRole("button", { name: /Retry|Try again/i })
    check(await retry.count() > 0, "outage offers Retry instead of a skeleton")
    check(await p.locator(".product-skeleton").count() === 0 || !(await p.locator(".product-skeleton").first().isVisible()), "no endless skeleton during an outage")
    down = false
    await retry.first().click()
    await p.locator(".product-card").first().waitFor({ timeout: 15000 })
    check(await p.locator(".product-card").count() === 6, "Retry loads the catalogue")
    await p.close()
  }
  console.log(`${checks} card UX checks passed; no remote writes`)
} finally { await browser.close() }
