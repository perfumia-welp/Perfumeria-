// Pixel comparison of full pages between a baseline build and the current build.
// Usage: BASELINE_URL=http://localhost:4174 BASE_URL=http://localhost:4173 node visual-diff.mjs [/route ...]
// Animations are frozen and the hero is held on slide 1 so captures are repeatable.
import fs from "node:fs"
import sharp from "sharp"
import { BASE, launch, WIDTHS } from "./lib.mjs"

const BASELINE = process.env.BASELINE_URL?.replace(/\/$/, "")
if (!BASELINE) {
  console.error(
    "Set BASELINE_URL to a server running the approved (baseline) build.",
  )
  process.exit(2)
}
const routes = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["/", "/products", "/about", "/contact", "/account", "/cart"]
const OUT = new URL("./output/", import.meta.url)
fs.mkdirSync(OUT, { recursive: true })

const browser = await launch()
const capture = async (url, width) => {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto(url, { waitUntil: "networkidle" })
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation-play-state:paused!important;transition:none!important}.hero__sheen{display:none!important}.hero__progress-fill,.hero-campaign__progress-fill{animation:none!important}",
  })
  await page.evaluate(async () => {
    document.querySelectorAll("img").forEach((i) => (i.loading = "eager"))
    await document.fonts.ready
  })
  await page.mouse.move(width - 2, 2)
  await page.waitForTimeout(2000)
  const buffer = await page.screenshot({ fullPage: true })
  await page.close()
  return sharp(buffer).raw().toBuffer({ resolveWithObject: true })
}

let changed = 0
for (const route of routes) {
  for (const width of WIDTHS) {
    const [a, b] = [
      await capture(BASELINE + route, width),
      await capture(BASE + route, width),
    ]
    const rows = Math.min(a.info.height, b.info.height)
    let diff = 0,
      first = -1,
      last = -1
    for (
      let i = 0;
      i < rows * a.info.width * a.info.channels;
      i += a.info.channels
    ) {
      const d =
        Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2])
      if (d > 30) {
        diff++
        const y = Math.floor(i / a.info.channels / a.info.width)
        if (first < 0) first = y
        last = y
      }
    }
    const heightChange = a.info.height !== b.info.height
    // A handful of pixels in photo areas is JPEG decode noise from the remote image host.
    const significant = heightChange || diff > 200
    if (significant) changed++
    console.log(
      `${
        significant ? "DIFF" : "same"
      }  ${route.padEnd(10)} @${width}  height ${a.info.height}→${b.info.height}  differing px ${diff}${
        diff ? ` (rows ${first}-${last})` : ""
      }`,
    )
  }
}
await browser.close()
console.log(
  `\n${changed} page/width combination(s) with significant differences`,
)
if (changed) process.exitCode = 1
