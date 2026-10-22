// Hero carousel (autoplay, pause, keyboard, swipe) and reviews carousel (controls, keyboard, swipe).
import { BASE, createReport, launch, trackErrors } from "./lib.mjs"

const report = createReport("Carousels")
const { check } = report
const browser = await launch()

// ---------------------------------------------------------------- Hero
let page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
trackErrors(page, report.errors)
const hero = () =>
  page.evaluate(() => ({
    slide: document.querySelector(".hero-campaign__index span").textContent,
    paused: document.querySelector(".hero-campaign").classList.contains("is-paused"),
    announced: document.querySelector(".hero-campaign [aria-live]").textContent,
  }))
await page.goto(BASE + "/", { waitUntil: "networkidle" })
await page.mouse.move(700, 0) // keep the pointer off the hero
await page.waitForTimeout(7800)
check((await hero()).slide === "02", "hero autoplay advances after ~7s")
await page.mouse.move(1000, 400)
await page.waitForTimeout(8000)
check(
  (await hero()).slide === "02" && (await hero()).paused,
  "hero pauses while hovered",
)
await page.mouse.move(700, 0)
await page.getByRole("button", { name: "Next slide" }).click()
await page.mouse.move(700, 0)
check(
  (await hero()).slide === "03" &&
    (await hero()).announced === "Slide 3 of 3: Oud / Night",
  "Next slide + announcement",
)
await page.waitForTimeout(5000)
check((await hero()).slide === "03", "manual navigation resets the 7s timer")
await page.getByRole("button", { name: "Pause slideshow" }).click()
await page.mouse.move(700, 0)
await page.waitForTimeout(8000)
check(
  (await hero()).slide === "03" && (await hero()).paused,
  "Pause button stops autoplay",
)
await page.getByRole("button", { name: "Play slideshow" }).click()
await page.locator(".hero-campaign .button-primary").focus()
await page.keyboard.press("Tab")
await page.keyboard.press("ArrowRight")
check(
  (await hero()).paused && (await hero()).announced.startsWith("Slide"),
  "keyboard focus pauses; arrow keys change slide",
)
await page.close()

const touch = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})
page = await touch.newPage()
trackErrors(page, report.errors)
await page.goto(BASE + "/", { waitUntil: "networkidle" })
// Hero B fills the first screen on phones: swipe across its photograph.
const visual = await page.locator(".hero-campaign__stage").boundingBox()
const cdp = await touch.newCDPSession(page)
const swipe = async (y, xs) => {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: xs[0], y }],
  })
  for (const x of xs.slice(1)) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y }],
    })
    await page.waitForTimeout(16)
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  })
  await page.waitForTimeout(400)
}
await swipe(visual.y + 200, [300, 240, 160, 100])
check((await hero()).slide === "02", "hero touch swipe")

await touch.close()

// ---------------------------------------------------------------- Reviews
// Reduced motion so the drift does not move the counter during the swipe.
const touchStill = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  reducedMotion: "reduce",
})
page = await touchStill.newPage()
trackErrors(page, report.errors)
const cdpStill = await touchStill.newCDPSession(page)
const swipeStill = async (y, xs) => {
  await cdpStill.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: xs[0], y }],
  })
  for (const x of xs.slice(1)) {
    await cdpStill.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y }],
    })
    await page.waitForTimeout(16)
  }
  await cdpStill.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  })
  await page.waitForTimeout(400)
}
await page.goto(BASE + "/", { waitUntil: "networkidle" })
await page.locator(".testimonials__viewport").scrollIntoViewIfNeeded()
const viewportBox = await page.locator(".testimonials__viewport").boundingBox()
await swipeStill(viewportBox.y + 150, [330, 290, 230, 170, 110, 70])
await page.waitForTimeout(800)
check(
  (await page.locator(".testimonials__controls span").textContent()) ===
    "04 / 05",
  "reviews touch swipe syncs counter",
  await page.locator(".testimonials__controls span").textContent(),
)
await touchStill.close()

// The reviews row loops (three copies; the outer two are inert clones) and
// drifts unless reduced motion is requested. Control checks run with reduced
// motion so positions are deterministic; the drift is checked separately.
for (const width of [1440, 390]) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  })
  page = await context.newPage()
  trackErrors(page, report.errors)
  await page.goto(BASE + "/", { waitUntil: "networkidle" })
  await page.locator(".testimonials").scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  const counter = () =>
    page.locator(".testimonials__controls span").textContent()
  // Cards on screen: F = fully visible, p = partly; off-screen copies are skipped.
  const visibleCards = () =>
    page.evaluate(() =>
      [...document.querySelector(".testimonials__viewport").children]
        .map((c) => {
          const r = c.getBoundingClientRect()
          return r.right <= 0 || r.left >= innerWidth
            ? ""
            : r.left >= -1 && r.right <= innerWidth + 1
              ? "F"
              : "p"
        })
        .join(""),
    )
  check(
    (await counter()) === "03 / 05",
    `reviews start centred @${width}`,
    await visibleCards(),
  )
  if (width === 1440)
    check(
      (await visibleCards()) === "pFFFp",
      "desktop shows partial + 3 full + partial",
      await visibleCards(),
    )
  const next = page.getByRole("button", { name: "Next review" })
  await next.click()
  await page.waitForTimeout(300)
  await next.click()
  await page.waitForTimeout(300)
  check((await counter()) === "05 / 05", `Next reaches the last review @${width}`)
  await next.click()
  await page.waitForTimeout(900)
  check(
    (await counter()) === "01 / 05" &&
      (await next.getAttribute("aria-disabled")) === null &&
      (await page.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      )) === "Next review",
    `Next wraps to the first review and keeps focus @${width}`,
    await counter(),
  )
  await page.locator(".testimonials__viewport").focus()
  await page.keyboard.press("End")
  await page.waitForTimeout(900)
  await page.keyboard.press("Home")
  await page.waitForTimeout(900)
  check((await counter()) === "01 / 05", `Home key @${width}`)
  await page.keyboard.press("ArrowRight")
  await page.waitForTimeout(700)
  check((await counter()) === "02 / 05", `ArrowRight @${width}`)
  await context.close()
}

// Drift: moves on its own when motion is allowed, stays still when reduced.
for (const reducedMotion of ["no-preference", "reduce"]) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion,
  })
  page = await context.newPage()
  trackErrors(page, report.errors)
  await page.goto(BASE + "/", { waitUntil: "networkidle" })
  await page.mouse.move(700, 0)
  await page.locator(".testimonials").scrollIntoViewIfNeeded()
  await page.mouse.move(700, 0)
  const position = () =>
    page.evaluate(() => {
      const v = document.querySelector(".testimonials__viewport")
      return v.scrollLeft + (parseFloat(v.style.getPropertyValue("--drift-offset")) || 0)
    })
  await page.waitForTimeout(1500)
  const before = await position()
  await page.waitForTimeout(2500)
  const moved = Math.abs((await position()) - before) > 2
  check(
    reducedMotion === "reduce" ? !moved : moved,
    reducedMotion === "reduce"
      ? "reviews stay still with reduced motion"
      : "reviews drift when motion is allowed",
  )
  await context.close()
}

await browser.close()
report.finish()
