// Bilingual (English / Arabic) checks: /ar routes, RTL layout at every
// width, untranslated text, metadata, language switching that keeps the bag,
// wishlist, session, query and form state, Arabic search, mirrored arrows,
// RTL carousels and reduced motion.
import {
  appLocation,
  BASE,
  createReport,
  launch,
  settle,
  signInPreview,
  trackErrors,
  WIDTHS,
} from "./lib.mjs"

const report = createReport("Bilingual EN / AR")
const { check } = report
const browser = await launch()

/** Arabic pages that declare no hreflang (src/lib/seo.ts rules). */
const NO_HREFLANG = new Set(["/ar/about", "/ar/wishlist", "/ar/cart", "/ar/sign-in", "/ar/sign-up", "/ar/forgot-password", "/ar/reset-password"])
const AR_ROUTES = [
  "/ar",
  "/ar/products",
  "/ar/products/velvet-iris",
  "/ar/about",
  "/ar/contact",
  "/ar/wishlist",
  "/ar/cart",
  "/ar/sign-in",
  "/ar/sign-up",
  "/ar/forgot-password",
  "/ar/reset-password",
  "/ar/no-such-page",
]

/*
 * Latin words allowed on Arabic pages: product and brand names, the EN | AR
 * labels, codes, currency and placeholder contact values. Anything else in
 * Latin letters is reported as untranslated.
 */
const LATIN_ALLOWED =
  /^(Perfumeria|Velvet|Iris|Nocturne|Rose|Santal|Lumière|Quiet|Oud|Amber|Reverie|Fleur|de|Peau|Cedar|Veil|Eau|Minuit|EN|AR|English|US|PRIVATE|ml|support|perfumeria|com|info|perfumira|XX|XXX|XXXX)$/

const visibleLatinWords = (page) =>
  page.evaluate(() => {
    const words = new Set()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const el = node.parentElement
      // The hero A/B toggle is a temporary design-review control.
      if (!el || el.closest("script, style, .visually-hidden, [aria-hidden=true], dialog:not([open]), [hidden], .hero-variant-toggle")) continue
      const style = getComputedStyle(el)
      if (style.display === "none" || style.visibility === "hidden") continue
      for (const word of node.textContent.match(/[A-Za-zÀ-ÿ]+/g) ?? []) words.add(word)
    }
    // Accessible names too: aria-label, placeholder, alt, title.
    document.querySelectorAll("[aria-label], [placeholder], img[alt], [title]").forEach((el) => {
      if (el.closest("dialog:not([open]), .hero-variant-toggle")) return
      for (const attr of ["aria-label", "placeholder", "alt", "title"]) {
        const value = el.getAttribute(attr)
        for (const word of value?.match(/[A-Za-zÀ-ÿ]+/g) ?? []) words.add(word)
      }
    })
    return [...words]
  })

// 1. Every Arabic route at every width: lang/dir, no overflow, metadata.
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  trackErrors(page, report.errors, `@${width} `)
  for (const route of AR_ROUTES) {
    await page.goto(BASE + route, { waitUntil: "networkidle" })
    await page.evaluate(() => document.fonts.ready)
    const info = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      overflow: document.documentElement.scrollWidth - innerWidth,
      title: document.title,
      header: document.querySelector(".site-header").getBoundingClientRect().height,
    }))
    check(
      info.lang === "ar" && info.dir === "rtl" && info.overflow <= 0,
      `${route} @${width}: ar/rtl, no horizontal overflow`,
      info.overflow > 0 || info.dir !== "rtl" ? info : "",
    )
    if (width === 1440) {
      check(/[؀-ۿ]/.test(info.title) || route === "/ar" || route.includes("velvet"), `${route}: localised title`, info.title)
      const untranslated = (await visibleLatinWords(page)).filter((w) => !LATIN_ALLOWED.test(w))
      check(untranslated.length === 0, `${route}: no untranslated text`, untranslated)
      const meta = await page.evaluate(() => ({
        alternates: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => `${l.hreflang}=${new URL(l.href).pathname}`),
        ogLocale: document.querySelector('meta[property="og:locale"]')?.content,
        canonical: document.querySelector('link[rel=canonical]')?.href ?? null,
        robots: document.querySelector('meta[name="robots"]')?.content ?? null,
      }))
      if (route === "/ar/no-such-page") {
        check(meta.alternates.length === 0 && meta.canonical === null, `${route}: 404 has no canonical/hreflang`, meta)
      } else if (NO_HREFLANG.has(route)) {
        // Personal pages (noindex) and Arabic About (not an approved translation yet).
        check(meta.ogLocale === "ar_AR" && meta.alternates.length === 0 && meta.robots === "noindex, follow", `${route}: og:locale, noindex, no hreflang`, meta)
      } else {
        const bare = route.replace(/^\/ar/, "") || "/"
        check(
          meta.ogLocale === "ar_AR" &&
            meta.alternates.some((a) => a.endsWith(`ar=${route}`)) &&
            meta.alternates.some((a) => a.endsWith(`en=${bare}`)) &&
            meta.alternates.some((a) => a.startsWith("x-default=")),
          `${route}: og:locale + hreflang en/ar/x-default`,
          meta,
        )
      }
    }
  }
  await page.close()
}

// 2. English is untouched: no prefix, ltr, English hreflang default.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  trackErrors(page, report.errors)
  await page.goto(BASE + "/products", { waitUntil: "networkidle" })
  const info = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    ar: [...document.querySelectorAll("main a[href]")].filter((a) => new URL(a.href).pathname.includes("/ar/")).length,
    switcher: [...document.querySelectorAll(".header-language a")].map((a) => [a.textContent, a.getAttribute("aria-current")]),
  }))
  check(info.lang === "en" && info.dir === "ltr" && info.ar === 0, "English pages: en/ltr, links stay unprefixed", info)
  check(JSON.stringify(info.switcher) === '[["EN","true"],["AR",null]]', "header switch EN | AR, EN current", info.switcher)
  await page.goto(BASE + "/en/products", { waitUntil: "networkidle" })
  check(await page.getByRole("heading", { name: "This page has drifted away." }).isVisible(), "/en/products is a 404 (English has no prefix)")
  await page.goto(BASE + "/fr", { waitUntil: "networkidle" })
  check(await page.getByRole("heading", { name: "This page has drifted away." }).isVisible(), "unknown language prefix is a 404")
  await page.close()
}

// 3. Switching language keeps URL state, bag, wishlist, scroll and forms.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  trackErrors(page, report.errors)
  const switchTo = async (lang) => {
    await page.evaluate((l) => document.querySelector(`.header-language a[hreflang=${l}]`).click(), lang)
    await page.waitForFunction((l) => document.documentElement.lang === l, lang)
    await settle(page)
  }
  await page.goto(BASE + "/products?gender=women&sort=price-desc", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Add to bag, Velvet Iris" }).click()
  await page.getByRole("button", { name: "Add to bag, Velvet Iris" }).click()
  await page.getByRole("button", { name: "Save to wishlist, Nocturne Rose" }).click()
  await page.evaluate(() => scrollTo(0, 400))
  await page.waitForTimeout(1500)
  const y = await page.evaluate(() => scrollY)
  await switchTo("ar")
  check((await appLocation(page)) === "/ar/products?gender=women&sort=price-desc", "query parameters kept", await appLocation(page))
  check((await page.locator(".header-actions a[href$='/ar/cart'] sup").textContent()) === "2", "bag kept (2 items)")
  check(await page.getByRole("button", { name: "أزل من المفضلة، Nocturne Rose" }).isVisible(), "wishlist kept")
  check(Math.abs((await page.evaluate(() => scrollY)) - y) < 40, "scroll position kept")
  const order = await page.locator(".catalogue__grid .product-card__link").allTextContents()
  check(order.join() === "Fleur de Peau,Nocturne Rose,Velvet Iris", "filters and sort identical in Arabic", order)
  check((await page.evaluate(() => localStorage.getItem("perfumeria:locale"))) === "ar", "language preference saved")
  await page.goto(BASE + "/about", { waitUntil: "networkidle" })
  check((await page.evaluate(() => document.documentElement.lang)) === "en", "an English URL is not overridden by the saved preference")

  await page.goto(BASE + "/products/velvet-iris", { waitUntil: "networkidle" })
  await switchTo("ar")
  check((await appLocation(page)) === "/ar/products/velvet-iris", "PDP → /ar/products/:slug")
  await switchTo("en")
  check((await appLocation(page)) === "/products/velvet-iris", "PDP → back to English")

  // In-app: bag → gift/promo → checkout fields survive switches.
  await page.goto(BASE + "/products", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Add to bag, Quiet Oud" }).click()
  await page.locator(".header-actions a[href$='/cart']").click()
  await settle(page)
  await page.getByText("This order is a gift").click()
  await page.locator(".gift-option textarea").fill("Happy birthday")
  await page.getByRole("button", { name: "Have a promo code?" }).click()
  await page.locator(".order-summary__promo-form input").fill("PRIVATE20")
  await switchTo("ar")
  check((await page.locator(".gift-option textarea").inputValue()) === "Happy birthday", "gift message kept")
  check((await page.locator(".order-summary__promo-form input").inputValue()) === "PRIVATE20", "promo code kept")
  check((await page.locator(".cart-line__details p").first().textContent()) === "عود · أرز", "bag lines re-read in Arabic")
  await page.locator(".order-summary__checkout").click()
  await page.waitForURL("**/ar/checkout")
  await settle(page)
  await page.locator("form.checkout-form button[type=submit]").click()
  check((await page.locator(".form-field__error").first().textContent()) === "يُرجى إدخال اسمك الكامل.", "Arabic validation")
  await page.locator("form.checkout-form input[name=fullName]").fill("سارة أحمد")
  check((await page.locator("form.checkout-form input[name=phone]").getAttribute("dir")) === "ltr", "phone field is LTR")
  check((await page.locator("form.checkout-form input[name=email]").getAttribute("dir")) === "ltr", "email field is LTR")
  await switchTo("en")
  check((await page.locator("form.checkout-form input[name=fullName]").inputValue()) === "سارة أحمد", "checkout fields kept")
  check((await page.locator(".form-field__error").first().textContent()).startsWith("Please"), "visible errors re-translated")
  await page.close()
}

// 3b. Auth email links return to the visitor's language. Every /auth/v1
// request is intercepted, so no email is sent.
for (const [prefix, label] of [["", "English"], ["/ar", "Arabic"]]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const redirects = {}
  await page.route("**/auth/v1/**", (route) => {
    const url = new URL(route.request().url())
    redirects[url.pathname.split("/").pop()] = url.searchParams.get("redirect_to")
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  })
  await page.goto(`${BASE}${prefix}/forgot-password`, { waitUntil: "networkidle" })
  await page.locator("form.auth-form input[name=email]").fill("test@example.com")
  await page.locator("form.auth-form button[type=submit]").click()
  await page.locator(".auth-message h2").waitFor()
  check(
    redirects.recover === `${BASE}${prefix}/reset-password`,
    `${label} reset email returns to ${prefix}/reset-password`,
    redirects.recover,
  )
  await page.close()
}

// 3c. The hero A/B comparison is development-only.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  for (const route of ["/", "/ar", "/?compare-hero"]) {
    await page.goto(BASE + route, { waitUntil: "networkidle" })
    check(
      (await page.locator(".hero-variant-toggle, .hero-campaign").count()) === 0,
      `${route}: no hero A/B control for customers`,
    )
  }
  await page.close()
}

// 4. Session survives a switch (UI-only signed-in preview).
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await signInPreview(page)
  await page.goto(BASE + "/account", { waitUntil: "networkidle" })
  await page.waitForTimeout(400)
  await page.evaluate(() => document.querySelector(".header-language a[hreflang=ar]").click())
  await page.waitForURL("**/ar/account")
  await settle(page, 400)
  check(await page.getByText("أهلًا بعودتك، Amira.").isVisible(), "session kept: Arabic account stays open")
  await page.close()
  const out = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await out.goto(BASE + "/ar/account", { waitUntil: "networkidle" })
  await settle(out, 400)
  check((await appLocation(out)) === "/ar/sign-in", "signed out: /ar/account → /ar/sign-in")
  await out.close()
}

// 5. Search, mirrored arrows, mobile menu and sheets.
{
  const page = await browser.newPage({ viewport: { width: 600, height: 900 } })
  trackErrors(page, report.errors)
  await page.goto(BASE + "/ar", { waitUntil: "networkidle" })
  await page.locator(".header-actions button[aria-controls=site-search]").click()
  const results = async (term) => {
    await page.locator("#site-search-input").fill(term)
    return page.locator(".search-result__name").allTextContents()
  }
  check((await results("عود")).join() === "Quiet Oud", "Arabic note search")
  check((await results("العود")).join() === "Quiet Oud", "search ignores the article (ال)")
  check((await results("velvet")).join() === "Velvet Iris", "Latin product names searchable in Arabic")
  check((await results("زهري")).length === 3, "Arabic family search")
  await page.keyboard.press("Enter")
  await page.waitForURL("**/ar/products?q=*")
  check((await appLocation(page)).startsWith("/ar/products?q="), "search submit stays in Arabic")

  const mirrored = await page.evaluate(() =>
    // Rendered icons only (those in a closed dialog have no computed transform).
    [...document.querySelectorAll(".icon--mirror .icon__glyph")]
      .filter((g) => g.getClientRects().length > 0)
      .every((g) => getComputedStyle(g).transform.startsWith("matrix(-1")),
  )
  check(mirrored, "arrows and chevrons mirrored in RTL")
  const dropdown = await page.evaluate(() =>
    document.querySelector(".filter-menu__chevron .icon__glyph") === null,
  )
  check(dropdown, "dropdown chevrons are not mirrored")

  await page.locator(".product-toolbar__mobile-filter").click()
  await page.waitForTimeout(500)
  const sheet = await page.locator(".mobile-filters").boundingBox()
  check(sheet.x < 2, "filter sheet opens from the left (inline end) in RTL", sheet)
  await page.keyboard.press("Escape")

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(BASE + "/ar", { waitUntil: "networkidle" })
  await page.locator(".menu-toggle").click()
  await page.waitForTimeout(400)
  check(await page.locator(".mobile-nav__language a[hreflang=en]").isVisible(), "language choice in the mobile menu")
  await page.locator(".mobile-nav__language a[hreflang=en]").click()
  await page.waitForFunction(() => document.documentElement.lang === "en")
  check((await appLocation(page)) === "/" && (await page.locator("#mobile-navigation[open]").count()) === 0, "mobile switch: English, menu closed")
  await page.close()
}

// 6. RTL carousels: drift and arrow keys follow the reading direction.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" })
  trackErrors(page, report.errors)
  await page.goto(BASE + "/ar", { waitUntil: "networkidle" })
  const viewport = page.locator(".testimonials__viewport")
  await viewport.scrollIntoViewIfNeeded()
  await page.mouse.move(5, 5)
  const before = await viewport.evaluate((el) => el.scrollLeft)
  await page.waitForTimeout(2500)
  const after = await viewport.evaluate((el) => el.scrollLeft)
  check(after < before, "testimonials drift left to right in Arabic (scrollLeft decreasing)", [before, after])

  const reduced = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })
  await reduced.goto(BASE + "/ar", { waitUntil: "networkidle" })
  const tv = reduced.locator(".testimonials__viewport")
  await tv.scrollIntoViewIfNeeded()
  await tv.focus()
  await reduced.keyboard.press("ArrowLeft")
  await reduced.waitForTimeout(400)
  check((await reduced.locator(".testimonials__controls > span").textContent()).startsWith("04"), "ArrowLeft = next review in Arabic")
  await reduced.getByRole("button", { name: "الرأي السابق" }).click()
  await reduced.waitForTimeout(400)
  check((await reduced.locator(".testimonials__controls > span").textContent()).startsWith("03"), "previous button steps back")
  const prev = await reduced.getByRole("button", { name: "الرأي السابق" }).boundingBox()
  const next = await reduced.getByRole("button", { name: "الرأي التالي" }).boundingBox()
  check(prev.x > next.x, "previous sits on the right, next on the left")
  check((await reduced.locator(".hero__toggle").count()) === 0, "reduced motion: no autoplay toggle (Arabic hero)")
  check((await reduced.locator(".special-offer video").count()) === 0, "reduced motion: still image instead of video")
  await reduced.locator(".hero__controls").focus()
  await reduced.locator(".hero__controls button").first().focus()
  await reduced.keyboard.press("ArrowLeft")
  await reduced.waitForTimeout(300)
  check((await reduced.locator(".hero__index span").first().textContent()) === "02", "hero: ArrowLeft = next slide in Arabic")
  await reduced.close()
  await page.close()
}

await browser.close()
report.finish()
