// Routing, navigation, titles, focus on navigation, 404, mobile menu and sheet focus containment.
import {
  appLocation,
  BASE,
  createReport,
  launch,
  settle,
  signInPreview,
  trackErrors,
} from "./lib.mjs"

const report = createReport("Routing and navigation")
const { check } = report
const browser = await launch()
const open = async (width = 1440) => {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  trackErrors(page, report.errors)
  return page
}
const info = async (page) => ({
  path: await appLocation(page),
  title: await page.title(),
  h1: await page.locator("main h1").first().textContent(),
  focus: await page.evaluate(
    () => document.activeElement.id || document.activeElement.tagName,
  ),
})

const p = await open()
await p.goto(BASE + "/", { waitUntil: "networkidle" })
await p.evaluate(() => (window.__noReload = true))

// Header navigation: route, title and focus moved to <main>.
for (const [name, path, title] of [
  ["About", "/about", "Perfume Importer & Distributor in Egypt, Since 1997 | Perfumira"],
  ["Products", "/products", "All Perfumes: Men's & Women's Fragrances | Perfumira"],
  ["Contact", "/contact", "Contact Perfumira | Orders & Wholesale Inquiries"],
  ["Home", "/", "Perfumira | Shop Perfumes Online in Egypt"],
]) {
  await p.locator(".main-nav").getByRole("link", { name, exact: true }).click()
  await settle(p)
  const s = await info(p)
  check(
    s.path === path &&
      s.title === title &&
      (path === "/" || s.focus === "main"),
    `header ${name}`,
    s,
  )
}
// Signed out, the header shows Sign In (it reads Account once signed in).
for (const [name, path, title] of [
  ["Sign In", "/sign-in", "Sign In | Perfumira"],
  [/^Bag/, "/cart", "Shopping Bag | Perfumira"],
]) {
  await p.locator(".header-actions").getByRole("link", { name }).click()
  await settle(p)
  const s = await info(p)
  check(s.path === path && s.title === title, `header ${String(name)}`, s.path)
}
await p
  .getByRole("banner")
  .getByRole("link", { name: "Perfumira home" })
  .first()
  .click()
await settle(p)
check((await appLocation(p)) === "/", "logo → home")
check(
  await p.evaluate(() => window.__noReload === true),
  "client-side navigation (no document reloads)",
)

// Footer links.
for (const [name, path] of Object.entries({
  "All Fragrances": "/products",
  "For Women": "/women-perfumes",
  "For Men": "/men-perfumes",
  Unisex: "/products?gender=unisex",
  Wishlist: "/wishlist",
  Contact: "/contact",
  "Returns & Exchanges": "/returns",
  FAQs: "/faq",
  "Track Order": "/contact?topic=track-order",
  "Our Story": "/about",
})) {
  await p.goto(BASE + "/", { waitUntil: "networkidle" })
  await p.locator("footer").getByRole("link", { name, exact: true }).click()
  await settle(p)
  check((await appLocation(p)) === path, `footer ${name}`, await appLocation(p))
}
await p.goto(BASE + "/", { waitUntil: "networkidle" })
// Pages that do not exist yet are plain text in the footer, never links.
for (const name of ["Ingredients", "Journal", "Stockists", "Privacy", "Terms"]) {
  const footer = p.locator("footer")
  check(
    (await footer.getByRole("link", { name, exact: true }).count()) === 0 &&
      (await footer.locator(".site-footer__placeholder", { hasText: name }).count()) === 1,
    `footer placeholder ${name} is not a link`,
  )
}
check(
  (await p.locator("footer a[href='#'], footer a:not([href])").count()) === 0,
  "footer has no dead links",
)

// Homepage links and CTAs.
for (const [selector, path, label] of [
  [".offers .text-link", "/products", "View All"],
  [".categories__support .text-link", "/products", "Explore All Fragrances"],
  [".category-card--featured", "/women-perfumes", "Women tile"],
  [
    ".categories__column .category-card >> nth=0",
    "/men-perfumes",
    "Men tile",
  ],
  [
    ".categories__column .category-card >> nth=1",
    "/products?gender=unisex",
    "Unisex tile",
  ],
]) {
  await p.goto(BASE + "/", { waitUntil: "networkidle" })
  await p.locator(selector).click()
  await settle(p)
  check((await appLocation(p)) === path, label, await appLocation(p))
}
await p.goto(BASE + "/", { waitUntil: "networkidle" })
await p.locator(".hero .button-primary").click()
await p.waitForTimeout(1000)
check((await appLocation(p)) === "/#products", "hero CTA scrolls to #products")

// Back / Forward with scroll restoration.
await p.goto(BASE + "/", { waitUntil: "networkidle" })
await p.evaluate(() => scrollTo({ top: 2000, behavior: "instant" }))
await p
  .locator(".main-nav")
  .getByRole("link", { name: "About", exact: true })
  .dispatchEvent("click")
await p.waitForTimeout(300)
check((await p.evaluate(() => scrollY)) === 0, "new page opens at the top")
await p.goBack()
await p.waitForTimeout(500)
check(
  (await appLocation(p)) === "/" &&
    Math.abs((await p.evaluate(() => scrollY)) - 2000) < 5,
  "Back restores page and scroll",
)
await p.goForward()
await p.waitForTimeout(400)
check((await appLocation(p)) === "/about", "Forward")
await p.close()

// Direct loads (needs SPA fallback on the server) and 404.
for (const path of [
  "/products?family=woody&sort=price-desc",
  "/products/velvet-iris",
  "/wishlist",
  "/about",
  "/contact",
  "/faq",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/cart",
]) {
  const q = await open()
  const response = await q.goto(BASE + path, { waitUntil: "networkidle" })
  check(
    response.ok() &&
      (await appLocation(q)) === path &&
      (await q.locator("main h1").count()) === 1,
    `direct load ${path}`,
    response.status(),
  )
  await q.close()
}
// Protected and bag-dependent routes redirect on a direct load.
for (const [path, target, setup] of [
  ["/account", "/sign-in", null],
  ["/account", "/account", signInPreview],
  ["/checkout", "/cart", null],
]) {
  const q = await open()
  if (setup) await setup(q)
  await q.goto(BASE + path, { waitUntil: "networkidle" })
  await q.waitForTimeout(300)
  check(
    (await appLocation(q)) === target &&
      (await q.locator("main h1").count()) === 1,
    `direct load ${path} → ${target}${setup ? " (signed in)" : ""}`,
    await appLocation(q),
  )
  await q.close()
}

for (const path of ["/not-a-page", "/products/not-a-fragrance"]) {
  const q = await open()
  await q.goto(BASE + path, { waitUntil: "networkidle" })
  const s = await info(q)
  check(s.title === "Page Not Found | Perfumira", `404 ${path}`, s.title)
  await q.getByRole("link", { name: "Return Home" }).click()
  await settle(q)
  check((await appLocation(q)) === "/", `404 Return Home ${path}`)
  await q.close()
}

// Mobile navigation.
const m = await open(390)
await m.goto(BASE + "/", { waitUntil: "networkidle" })
const menu = m.getByRole("button", { name: "Menu" })
const menuOpen = () =>
  m.evaluate(() => document.querySelector("dialog.mobile-nav").open)
await menu.click()
await m.waitForTimeout(350)
check(
  await m.evaluate(() => !!document.activeElement.closest("dialog.mobile-nav")),
  "menu opens with focus inside",
)
check(
  await m.evaluate(
    () => getComputedStyle(document.documentElement).overflow === "hidden",
  ),
  "page scroll locked while menu is open",
)
await m.keyboard.press("Escape")
await m.waitForTimeout(300)
check(
  !(await menuOpen()) &&
    (await m.evaluate(() => document.activeElement.textContent.trim())) ===
      "Menu",
  "Esc closes menu, focus returns to Menu",
)
for (const [name, path] of [
  ["About", "/about"],
  ["Products", "/products"],
  ["Contact", "/contact"],
  ["Home", "/"],
]) {
  await menu.click()
  await m.waitForTimeout(300)
  await m
    .locator("dialog.mobile-nav")
    .getByRole("link", { name, exact: true })
    .click()
  await m.waitForTimeout(300)
  check(
    (await appLocation(m)) === path && !(await menuOpen()),
    `menu → ${name}`,
  )
}
await menu.click()
await m.waitForTimeout(300)
await m.setViewportSize({ width: 1200, height: 900 })
await m.waitForTimeout(300)
check(!(await menuOpen()), "menu closes when resized to desktop")
await m.close()

// Modal sheets keep focus out of the page behind them. Tab may pass to the
// browser UI (reported as <body>) and back; it must never reach page content.
for (const [width, trigger, selector] of [
  [390, /^Menu$/, "dialog.mobile-nav"],
  [1440, /^Search$/, "#site-search"],
  [390, /^Filter/, "dialog.mobile-filters"],
]) {
  const q = await open(width)
  await q.goto(BASE + "/products", { waitUntil: "networkidle" })
  await q
    .locator("header, .product-toolbar")
    .getByRole("button", { name: trigger })
    .first()
    .click()
  await q.waitForTimeout(350)
  let escaped = false
  for (let i = 0; i < 40; i++) {
    await q.keyboard.press("Tab")
    escaped ||= await q.evaluate(
      (s) =>
        document.activeElement !== document.body &&
        !document.activeElement.closest(s),
      selector,
    )
  }
  check(!escaped, `focus contained in ${selector} @${width}`)
  await q.close()
}

await browser.close()
report.finish()
