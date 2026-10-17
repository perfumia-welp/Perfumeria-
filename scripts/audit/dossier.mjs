import { chromium } from "playwright-core"

const BASE = (process.env.DEV_URL || "http://127.0.0.1:8443").replace(/\/$/, "")
const WIDTHS = [1440, 1280, 1024, 768, 430, 390, 375]
const browser = await chromium.launch({ channel: "chrome" })
const failures = []

const check = (condition, label) => {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`)
  if (!condition) failures.push(label)
}

console.log("\n== C · Scent Dossier")

for (const width of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    hasTouch: width <= 768,
    isMobile: width <= 430,
  })
  const page = await context.newPage()
  await page.goto(`${BASE}/products?compare-card=c`, { waitUntil: "networkidle" })
  const card = page.locator(".dossier-card").first()
  check((await card.count()) === 1, `${width}: C selected instantly`)
  check(await page.getByRole("button", { name: /C · Scent Dossier/ }).getAttribute("aria-pressed") === "true", `${width}: selector active`)
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: no overflow`)

  const stage = card.locator(".dossier-card__stage")
  const bottle = card.locator(".dossier-card__image-link img")
  check((await bottle.boundingBox())?.height > 0, `${width}: bottle visible`)

  if (width > 768) {
    await card.hover()
    const sheet = card.locator(".dossier-card__sheet")
    check(await sheet.isVisible(), `${width}: hover reveals dossier`)
    const stageBox = await stage.boundingBox()
    const sheetBox = await sheet.boundingBox()
    check(Boolean(stageBox && sheetBox && sheetBox.height / stageBox.height >= .25 && sheetBox.height / stageBox.height <= .36), `${width}: reveal occupies 25–35%`)
    await card.locator(".dossier-card__name a").focus()
    check(await sheet.isVisible(), `${width}: focus reveals dossier`)
  } else if (width > 430) {
    const toggle = card.locator(".dossier-card__notes-toggle")
    check(await toggle.isVisible(), `${width}: touch Notes control visible`)
    await toggle.click()
    check(await card.locator(".dossier-card__sheet").isVisible(), `${width}: touch control expands dossier`)
  } else {
    check(!(await card.locator(".dossier-card__notes-toggle").isVisible()), `${width}: compact mobile uses character line only`)
  }
  await context.close()
}

const rtl = await browser.newPage({ viewport: { width: 1024, height: 1000 } })
await rtl.goto(`${BASE}/ar/products?compare-card=c`, { waitUntil: "networkidle" })
check(await rtl.locator("html").getAttribute("dir") === "rtl", "Arabic uses RTL")
check((await rtl.locator(".dossier-card__sheet dt").first().textContent())?.includes("النفحات") === true, "Arabic note labels are localized")
check(await rtl.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Arabic has no overflow")
await rtl.close()

const reduced = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } })
const reducedPage = await reduced.newPage()
await reducedPage.goto(`${BASE}/products?compare-card=c`, { waitUntil: "networkidle" })
const reducedState = await reducedPage.locator(".dossier-card__sheet").first().evaluate((node) => ({
  duration: getComputedStyle(node).transitionDuration,
  matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
}))
check(reducedState.matches && reducedState.duration.split(", ").every((value) => parseFloat(value) <= .001), `reduced motion disables reveal transition (${reducedState.duration})`)
await reduced.close()

await browser.close()
console.log(`\n${failures.length} failure(s)${failures.length ? `: ${failures.join("; ")}` : ""}`)
if (failures.length) process.exitCode = 1
