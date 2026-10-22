// Cross-page consistency (gutters, header, footer), visible keyboard focus, reduced motion.
import { BASE, createReport, launch, trackErrors } from "./lib.mjs"

const ROUTES = [
  "/",
  "/products",
  "/products/velvet-iris",
  "/wishlist",
  "/sign-in",
  "/about",
  "/contact",
  "/account",
  "/cart",
  "/missing-page",
]
/** Element that starts each page's content at the gutter (the intro eyebrow by default). */
const ANCHORS = { "/products/velvet-iris": ".pdp__breadcrumb" }

const report = createReport("Consistency, focus visibility, reduced motion")
const { check } = report
const browser = await launch()

for (const width of [1440, 1024, 768, 390]) {
  const signatures = []
  for (const route of ROUTES) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    trackErrors(page, report.errors)
    await page.goto(BASE + route, { waitUntil: "networkidle" })
    signatures.push(
      await page.evaluate((anchor) => {
        const box = (s) => document.querySelector(s).getBoundingClientRect()
        return JSON.stringify({
          logoLeft: Math.round(box(".site-header .site-logo").left),
          actionsRight: Math.round(innerWidth - box(".header-actions").right),
          header: Math.round(box(".site-header").height),
          footer: Math.round(box("footer").height),
          eyebrowLeft: Math.round(
            document.querySelector(anchor)?.getBoundingClientRect()
              .left ?? -1,
          ),
          font: getComputedStyle(document.body).fontFamily.split(",")[0],
        })
      }, ANCHORS[route] ?? "main .eyebrow"),
    )
    await page.close()
  }
  check(
    new Set(signatures).size === 1,
    `gutters, header, footer and type identical on ${ROUTES.length} routes @${width}`,
    signatures[0],
  )
}

// Every Tab stop must show an outline, ring or underline (read after transitions settle).
for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  trackErrors(page, report.errors)
  await page.goto(BASE + route, { waitUntil: "networkidle" })
  const missing = new Set()
  let stops = 0
  for (let i = 0; i < 70; i++) {
    await page.keyboard.press("Tab")
    await page.waitForTimeout(260)
    const result = await page.evaluate(() => {
      const e = document.activeElement
      if (!e || e === document.body) return null
      const cs = getComputedStyle(e)
      const outline =
        cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0
      const ring =
        cs.boxShadow !== "none" && !/ 0px 0px 0px 0px/.test(` ${cs.boxShadow}`)
      const fieldUnderline = !!e.closest(
        ".newsletter-form__field, .search-overlay__field",
      )
      return {
        ok: outline || ring || fieldUnderline,
        name: (
          e.getAttribute("aria-label") ||
          e.textContent ||
          e.name ||
          e.tagName
        )
          .trim()
          .slice(0, 30),
      }
    })
    if (!result) continue
    stops++
    if (!result.ok) missing.add(result.name)
  }
  check(
    missing.size === 0,
    `visible focus on all ${stops} Tab stops: ${route}`,
    missing.size ? [...missing].join(", ") : "",
  )
  await page.close()
}

// Reduced motion: no autoplay, no reflection sweep, no smooth scrolling, near-zero transitions.
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
})
const page = await context.newPage()
trackErrors(page, report.errors)
await page.goto(BASE + "/", { waitUntil: "networkidle" })
await page.waitForTimeout(8000)
const motion = await page.evaluate(() => ({
  stillOnFirstSlide:
    document.querySelector(".hero-campaign__index span").textContent === "01",
  noPauseButton:
    document.querySelectorAll(".hero-campaign__controls button").length === 2,
  scroll: getComputedStyle(document.documentElement).scrollBehavior,
  transition: parseFloat(
    getComputedStyle(document.querySelector(".product-card__media img"))
      .transitionDuration,
  ),
}))
check(
  motion.stillOnFirstSlide &&
    motion.noPauseButton &&
    motion.scroll === "auto" &&
    motion.transition < 0.01,
  "reduced motion respected",
  motion,
)
await context.close()

await browser.close()
report.finish()
