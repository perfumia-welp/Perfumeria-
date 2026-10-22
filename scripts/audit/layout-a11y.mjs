// Responsive + accessibility sweep of every page/state at every width.
// Checks: horizontal overflow, overlapping text, clipped controls, stretched images,
// target size (WCAG 2.5.8 incl. spacing exception), accessible names, img alt,
// heading outline and computed colour contrast.
import {
  BASE,
  createReport,
  createAccountData,
  fillBag,
  launch,
  signInPreview,
  trackErrors,
  WIDTHS,
} from "./lib.mjs"

// Approved exception: brand-champagne display words (large decorative type):
// the italic hero and offer words, and the About collection's large proof
// figures (28–56px display type; their labels stay in the text colour).
const ALLOWED_CONTRAST = [
  /^contrast EM "(Moment|Special|Fragrance)"/,
  /^contrast about-collection__proof-value /,
]

const states = {
  home: (p) => p.goto(BASE + "/", { waitUntil: "networkidle" }),
  products: (p) => p.goto(BASE + "/products", { waitUntil: "networkidle" }),
  "products no-results": (p) =>
    p.goto(BASE + "/products?gender=men&family=floral", {
      waitUntil: "networkidle",
    }),
  about: (p) => p.goto(BASE + "/about", { waitUntil: "networkidle" }),
  contact: (p) => p.goto(BASE + "/contact", { waitUntil: "networkidle" }),
  "contact errors": async (p) => {
    await p.goto(BASE + "/contact", { waitUntil: "networkidle" })
    await p.locator(".contact-form button[type=submit]").click()
  },
  "product page": (p) =>
    p.goto(BASE + "/products/velvet-iris", { waitUntil: "networkidle" }),
  "product page sold out": (p) =>
    p.goto(BASE + "/products/eau-de-minuit", { waitUntil: "networkidle" }),
  "wishlist empty": (p) =>
    p.goto(BASE + "/wishlist", { waitUntil: "networkidle" }),
  "wishlist filled": async (p) => {
    await p.addInitScript(() =>
      localStorage.setItem(
        "perfumeria:wishlist",
        '["velvet-iris","quiet-oud","amber-reverie"]',
      ),
    )
    await p.goto(BASE + "/wishlist", { waitUntil: "networkidle" })
  },
  "sign in": (p) => p.goto(BASE + "/sign-in", { waitUntil: "networkidle" }),
  "sign up errors": async (p) => {
    await p.goto(BASE + "/sign-up", { waitUntil: "networkidle" })
    await p.locator("main form button[type=submit]").click()
  },
  "forgot password": (p) =>
    p.goto(BASE + "/forgot-password", { waitUntil: "networkidle" }),
  "reset password (no link)": (p) =>
    p.goto(BASE + "/reset-password", { waitUntil: "networkidle" }),
  account: async (p) => {
    await signInPreview(p)
    await p.addInitScript(() =>
      localStorage.setItem(
        "perfumeria:wishlist",
        '["velvet-iris","quiet-oud"]',
      ),
    )
    await p.goto(BASE + "/account", { waitUntil: "networkidle" })
  },
  "account empty": async (p) => {
    await signInPreview(p, createAccountData("empty"))
    await p.goto(BASE + "/account", { waitUntil: "networkidle" })
  },
  // The address and details forms live on their own account pages.
  "account address editing": async (p) => {
    await signInPreview(p)
    await p.goto(BASE + "/account/addresses", { waitUntil: "networkidle" })
    await p
      .locator("#account-addresses .account-section__heading button")
      .click()
    await p.locator("form.account-form button[type=submit]").first().click()
  },
  "account details editing": async (p) => {
    await signInPreview(p)
    await p.goto(BASE + "/account/details", { waitUntil: "networkidle" })
    await p.locator("#account-details .account-section__heading button").click()
    await p.locator("form.account-form button[type=submit]").first().click()
  },
  "bag empty": (p) => p.goto(BASE + "/cart", { waitUntil: "networkidle" }),
  "bag filled": async (p) => {
    await fillBag(p, ["Velvet Iris", "Santal Lumière", "Amber Reverie"])
    await p.getByRole("button", { name: /Have a promo code/ }).click()
    await p.getByLabel("This order is a gift").check()
  },
  checkout: async (p) => {
    await fillBag(p, ["Velvet Iris", "Quiet Oud"])
    await p
      .getByRole("button", { name: /Proceed to Checkout/ })
      .first()
      .click()
    await p.waitForTimeout(400)
    await p.locator(".checkout-form button[type=submit]").click()
  },
  404: (p) => p.goto(BASE + "/missing-page", { waitUntil: "networkidle" }),
  "search open": async (p) => {
    await p.goto(BASE + "/", { waitUntil: "networkidle" })
    await p
      .locator(".header-actions")
      .getByRole("button", { name: "Search" })
      .click()
    await p.waitForTimeout(350)
    await p.keyboard.type("amber")
  },
}

/** Runs in the page; returns a list of issue strings. */
function inspect() {
  const out = []
  // Faded out by itself or by an ancestor (stacked crossfade items).
  const transparent = (e) => {
    for (let node = e; node && node !== document.body; node = node.parentElement)
      if (getComputedStyle(node).opacity === "0") return true
    return false
  }
  const visible = (e) => {
    const r = e.getBoundingClientRect()
    const cs = getComputedStyle(e)
    return (
      r.width > 0 &&
      r.height > 0 &&
      cs.visibility !== "hidden" &&
      !transparent(e) &&
      !e.closest(
        ".visually-hidden, [hidden], dialog:not([open]), [aria-hidden=true]",
      )
    )
  }
  const scope = document.querySelector("dialog[open]") || document
  // Fixed layers above the page: the sticky header and the responsive contact action.
  const layer = (e) =>
    e.closest(".site-header, .contact-launcher, .mobile-whatsapp")

  // WCAG 2.4.11: the focused element must not be hidden by the sticky header.
  const focused = document.activeElement
  const header = document.querySelector(".site-header")
  if (
    focused &&
    focused !== document.body &&
    !focused.closest(".site-header, dialog") &&
    header
  ) {
    const f = focused.getBoundingClientRect()
    const h = header.getBoundingClientRect()
    if (f.height && f.top < h.bottom - 1 && f.bottom > 0)
      out.push(`focus obscured by header: ${focused.id || focused.tagName}`)
  }

  const overflow = document.documentElement.scrollWidth - innerWidth
  if (overflow > 0) out.push(`horizontal overflow ${overflow}px`)

  const texts = [
    ...scope.querySelectorAll("h1,h2,h3,p,dt,dd,label,button,a,li > span"),
  ].filter(
    (e) =>
      visible(e) &&
      !e.closest(
        ".testimonials__viewport,.product-grid,.category-card,.hero__visual,.hero-campaign__stage,.mobile-checkout",
      ),
  )
  for (let a = 0; a < texts.length; a++)
    for (let c = a + 1; c < texts.length; c++) {
      const A = texts[a],
        C = texts[c]
      if (A.contains(C) || C.contains(A)) continue
      // Content scrolled beneath the sticky header or the launcher is layering, not overlap.
      if (layer(A) !== layer(C)) continue
      const x = A.getBoundingClientRect(),
        y = C.getBoundingClientRect()
      if (
        Math.min(x.right, y.right) - Math.max(x.left, y.left) > 2 &&
        Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 2
      )
        out.push(
          `overlap: ${A.className || A.tagName} / ${C.className || C.tagName}`,
        )
    }

  for (const e of scope.querySelectorAll("button, a, label, input")) {
    if (
      visible(e) &&
      e.scrollWidth > e.clientWidth + 1 &&
      getComputedStyle(e).overflow !== "visible" &&
      !e.closest(".account-nav ul")
    )
      out.push(
        `clipped control: ${(e.getAttribute("aria-label") || e.textContent).trim().slice(0, 24)}`,
      )
  }

  for (const i of scope.querySelectorAll("img")) {
    if (!visible(i) || !i.naturalWidth) continue
    if (["cover", "contain"].includes(getComputedStyle(i).objectFit)) continue
    const r = i.getBoundingClientRect()
    if (Math.abs(r.width / r.height - i.naturalWidth / i.naturalHeight) > 0.03)
      out.push(`stretched image ${i.currentSrc.split("/").pop().slice(0, 30)}`)
  }

  const targets = [
    ...scope.querySelectorAll(
      "a, button, input:not([type=hidden]), textarea, select",
    ),
  ].filter(visible)
  for (const e of targets) {
    if (e.tagName === "A" && e.closest("p")) continue // inline text links are exempt
    if (
      e.matches("input[type=checkbox], input[type=radio]") &&
      e.closest("label")
    )
      continue // label is the target
    const r = e.getBoundingClientRect()
    if (r.width >= 24 && r.height >= 24) continue
    const cx = r.left + r.width / 2,
      cy = r.top + r.height / 2
    const crowded = targets.some((o) => {
      if (o === e || o.contains(e) || e.contains(o)) return false
      if (layer(o) !== layer(e)) return false
      const q = o.getBoundingClientRect()
      return (
        Math.hypot(
          Math.max(q.left - cx, 0, cx - q.right),
          Math.max(q.top - cy, 0, cy - q.bottom),
        ) < 12
      )
    })
    if (crowded)
      out.push(
        `crowded small target: ${(e.getAttribute("aria-label") || e.textContent || e.name).trim().slice(0, 28)}`,
      )
  }

  for (const e of scope.querySelectorAll(
    "a, button, input, textarea, select",
  )) {
    if (!visible(e) || e.type === "hidden") continue
    const named =
      e.getAttribute("aria-label") ||
      e.getAttribute("aria-labelledby") ||
      (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) ||
      e.closest("label") ||
      e.textContent.trim()
    if (!named) out.push(`no accessible name: ${e.outerHTML.slice(0, 60)}`)
  }
  for (const i of document.querySelectorAll("img"))
    if (!i.hasAttribute("alt")) out.push(`img missing alt: ${i.src.slice(-30)}`)

  const headings = [
    ...document.querySelectorAll("main h1, main h2, main h3, main h4"),
  ]
  if (document.querySelectorAll("main h1").length !== 1)
    out.push(`h1 count ${document.querySelectorAll("main h1").length}`)
  headings.forEach((h, i) => {
    if (i && Number(h.tagName[1]) - Number(headings[i - 1].tagName[1]) > 1)
      out.push(`heading skip ${headings[i - 1].tagName}→${h.tagName}`)
  })

  const parse = (c) => {
    const m = c.match(/[\d.]+/g).map(Number)
    const k = c.startsWith("color(") ? 255 : 1
    return { r: m[0] * k, g: m[1] * k, b: m[2] * k, a: m[3] ?? 1 }
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const blend = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  })
  const background = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (
        cs.backgroundImage !== "none" &&
        !cs.backgroundImage.includes("gradient")
      )
        return null
      const c = parse(cs.backgroundColor)
      if (c.a > 0) {
        layers.push(c)
        if (c.a >= 1) break
      }
    }
    return layers.reverse().reduce((base, layer) => blend(layer, base), {
      r: 255,
      g: 255,
      b: 255,
      a: 1,
    })
  }
  const seen = new Set()
  for (const el of scope.querySelectorAll("body *")) {
    if (
      !visible(el) ||
      el.closest(
        "svg, .category-card, .hero__visual, .hero-campaign__stage, .special-offer__media, .editorial-figure, .product-card__media, .skip-link",
      )
    )
      continue
    if (
      ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    )
      continue
    if (el.closest("[aria-disabled=true]") || el.matches(":disabled")) continue
    const bg = background(el)
    if (!bg) continue
    const cs = getComputedStyle(el)
    const fg = blend(parse(cs.color), bg)
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
    const ratio = (hi + 0.05) / (lo + 0.05)
    const size = parseFloat(cs.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
    const key = `contrast ${
      el.tagName === "EM" ? "EM" : el.className || el.tagName
    } "${el.textContent.trim().slice(0, 18)}" ${ratio.toFixed(2)}:1`
    if (ratio < (large ? 3 : 4.5) && !seen.has(key)) {
      seen.add(key)
      out.push(key)
    }
  }
  return out
}

const report = createReport("Responsive + accessibility sweep")
const browser = await launch()
const found = new Map()
// STATES=home,about runs only those states (quicker reruns).
const only = process.env.STATES?.split(",")
for (const [state, setup] of Object.entries(states).filter(([s]) => !only || only.includes(s))) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    trackErrors(page, report.errors, `${state}@${width}: `)
    await setup(page)
    await page.evaluate(async () => {
      document.querySelectorAll("img").forEach((i) => (i.loading = "eager"))
      await document.fonts.ready
    })
    await page.waitForTimeout(500)
    for (const issue of await page.evaluate(inspect)) {
      if (ALLOWED_CONTRAST.some((re) => re.test(issue))) continue
      const key = `${state}: ${issue}`
      found.set(key, [...(found.get(key) || []), width])
    }
    await page.close()
  }
  const issues = [...found].filter(([k]) => k.startsWith(state + ":"))
  report.check(issues.length === 0, `${state} @ ${WIDTHS.join("/")}`)
  // Printed per state, so a later failure cannot hide them.
  for (const [issue, widths] of issues)
    console.log(`   ${issue}  @${widths.join("/")}`)
}
await browser.close()
report.finish()
