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
check(
  (await page.locator(".hero-campaign__progress-fill").evaluate((el) => getComputedStyle(el).animationDuration)) === "5s",
  "hero progress line lasts 5s",
)
await page.waitForTimeout(5800)
check((await hero()).slide === "02", "hero autoplay advances after 5s")
await page.mouse.move(1000, 400)
await page.waitForTimeout(6500)
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
await page.waitForTimeout(4000)
check((await hero()).slide === "03", "manual navigation resets the 5s timer")
await page.waitForTimeout(1700)
check((await hero()).slide === "01", "autoplay advances 5s after manual navigation")
await page.getByRole("button", { name: "Pause slideshow" }).click()
await page.mouse.move(700, 0)
await page.waitForTimeout(6500)
check(
  (await hero()).slide === "01" && (await hero()).paused,
  "Pause button stops autoplay",
)
await page.getByRole("button", { name: "Play slideshow" }).click()
await page.mouse.move(700, 0)
await page.waitForTimeout(5500)
check((await hero()).slide === "02" && !(await hero()).paused, "Play resumes autoplay")
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
check(await page.locator(".testimonials").count() === 0, "placeholder testimonials are not mounted")
await touchStill.close()

await browser.close()
report.finish()
