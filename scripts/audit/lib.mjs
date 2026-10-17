import { chromium } from "playwright-core"
import fs from "node:fs"
import {
  createAccountData,
  mockSupabaseRest,
  PREVIEW_USER_ID,
} from "./mockSupabase.mjs"

/** Production preview of the app (`pnpm build && pnpm preview`). */
export const BASE = (process.env.BASE_URL || "http://localhost:4173").replace(
  /\/$/,
  "",
)
/** Optional dev server (`pnpm dev`), needed only for dev-only previews such as empty account states. */
export const DEV = process.env.DEV_URL?.replace(/\/$/, "")
export const WIDTHS = [1440, 1280, 1024, 768, 430, 390, 375, 320]

/** Deployment sub-path of BASE_URL (e.g. "/site"), so checks also work on a deploy preview. */
export const BASE_PATH = new URL(BASE).pathname.replace(/\/$/, "")

/** Current app route (pathname + search + hash) without the deployment sub-path. */
export const appLocation = (page) =>
  page.evaluate(
    (base) =>
      (location.pathname.slice(base.length) || "/") +
      location.search +
      location.hash,
    BASE_PATH,
  )

/** Uses an installed Chrome (or CHROME_PATH); no Playwright browser download needed. */
export function launch() {
  return process.env.CHROME_PATH
    ? chromium.launch({ executablePath: process.env.CHROME_PATH })
    : chromium.launch({ channel: "chrome" })
}

/** Console errors/warnings from the app, ignoring third-party image hosts and missing favicon. */
export function trackErrors(page, sink, label = "") {
  const ignore = /unsplash|ERR_SSL|favicon|status of 404|\[vite\]/i
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type()) && !ignore.test(m.text()))
      sink.push(`${label}${m.text()}`)
  })
  page.on("pageerror", (e) => sink.push(`${label}${e}`))
}

/** Pass/fail recorder; `finish()` prints a summary and sets the exit code. */
export function createReport(title) {
  const failures = []
  const errors = []
  console.log(`\n== ${title}`)
  return {
    errors,
    check(condition, label, detail = "") {
      if (!condition) failures.push(label)
      const info =
        detail === ""
          ? ""
          : `  ${typeof detail === "object" ? JSON.stringify(detail) : detail}`
      console.log(`${condition ? "PASS" : "FAIL"}  ${label}${info}`)
    },
    finish() {
      console.log(
        `\n${failures.length} failure(s)${
          failures.length ? ": " + failures.join("; ") : ""
        }`,
      )
      console.log(
        `console errors: ${errors.length ? errors.join(" | ") : "none"}`,
      )
      if (failures.length || errors.length) process.exitCode = 1
    },
  }
}

/** Adds the given products to the bag from /products, then opens the bag. */
export async function fillBag(page, names) {
  await page.goto(BASE + "/products", { waitUntil: "networkidle" })
  for (const name of names)
    await page.getByRole("button", { name: `Add to bag, ${name}` }).click()
  await page.locator('.header-actions a[href$="/cart"]').click()
  await page.waitForTimeout(250)
}

/** Waits for a client-side navigation (and any lazily loaded page chunk) to settle. */
export async function settle(page, ms = 250) {
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(ms)
}

/*
 * UI-only signed-in state: stores an unexpired, fake Supabase session in
 * localStorage so protected screens render. Supabase is never contacted:
 * auth calls are blocked and account data (profile, addresses, orders) is
 * served by an in-memory mock (mockSupabase.mjs), so this proves nothing
 * about real auth or RLS (see database.mjs and the live checks for that).
 * The storage key comes from VITE_SUPABASE_URL in .env.local / .env.
 */
function supabaseRef() {
  for (const file of ["../../.env.local", "../../.env"]) {
    try {
      const text = fs.readFileSync(new URL(file, import.meta.url), "utf8")
      const url = text.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
      if (url) return new URL(url).hostname.split(".")[0]
    } catch {}
  }
  return null
}

export const PREVIEW_USER = {
  firstName: "Amira",
  lastName: "Preview",
  email: "preview.client@example.com",
}

/** Signs the page in as the preview user; returns the mock account data it serves. */
export async function signInPreview(page, data = createAccountData()) {
  const ref = supabaseRef()
  if (!ref)
    throw new Error("Set VITE_SUPABASE_URL in .env.local for signed-in checks.")
  const now = Math.floor(Date.now() / 1000)
  const session = {
    access_token: "preview",
    refresh_token: "preview",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    user: {
      id: PREVIEW_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: PREVIEW_USER.email,
      user_metadata: {
        first_name: PREVIEW_USER.firstName,
        last_name: PREVIEW_USER.lastName,
      },
      app_metadata: {},
      created_at: new Date().toISOString(),
    },
  }
  // Block real auth traffic so the fake token is never sent anywhere.
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  )
  await page.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value)
    },
    [`sb-${ref}-auth-token`, JSON.stringify(session)],
  )
  await mockSupabaseRest(page, data)
  return data
}

export { createAccountData }
