import { BASE, appLocation, launch, settle, signInPreview } from "./lib.mjs"

const browser = await launch()
const errors = []

async function checkLocale(prefix, labels, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.emulateMedia({ reducedMotion: "reduce" })
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  page.on("pageerror", (error) => errors.push(error.message))
  await signInPreview(page)
  await page.goto(`${BASE}${prefix}/account`, { waitUntil: "networkidle" })
  await settle(page, 250)

  const nav = page.getByRole("navigation", { name: labels.navigation })
  await page.evaluate(() => {
    window.__accountSpaMarker = crypto.randomUUID()
    document.querySelector(".account-nav").dataset.mountMarker =
      window.__accountSpaMarker
  })

  for (const [label, path] of labels.routes) {
    await nav.getByRole("link", { name: label, exact: true }).click()
    await page.waitForURL(`**${prefix}${path}`)
    await settle(page, 80)
    const state = await page.evaluate(() => ({
      windowMarker: window.__accountSpaMarker,
      navMarker: document.querySelector(".account-nav")?.dataset.mountMarker,
      current: document
        .querySelector(".account-nav a[aria-current=page]")
        ?.textContent?.trim(),
    }))
    if (!state.windowMarker || state.windowMarker !== state.navMarker)
      throw new Error(`${prefix || "/en"}${path}: document or layout reloaded`)
    if (state.current !== label)
      throw new Error(
        `${prefix || "/en"}${path}: active link was ${state.current}`,
      )
    const position = await page
      .locator(".account-content__route")
      .evaluate((element) => ({
        top: element.getBoundingClientRect().top,
        scrollY,
        height: document.documentElement.scrollHeight,
        viewport: innerHeight,
        minimum: getComputedStyle(element).minHeight,
        offset:
          Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--header-height",
            ),
          ) + 32,
      }))
    if (Math.abs(position.top - position.offset) > 2)
      throw new Error(
        `${prefix || "/en"}${path}: content top ${position.top}, expected ${position.offset}; ${JSON.stringify(position)}`,
      )
  }

  await page.goBack()
  await page.waitForURL(`**${prefix}/account/addresses`)
  await page.goForward()
  await page.waitForURL(`**${prefix}/account/details`)
  if ((await appLocation(page)) !== `${prefix}/account/details`)
    throw new Error(`${prefix || "/en"}: Back/Forward failed`)
  await page.close()
}

const english = {
  navigation: "Account",
  routes: [
    ["Orders", "/account/orders"],
    ["Overview", "/account"],
    ["Wishlist", "/account/wishlist"],
    ["Addresses", "/account/addresses"],
    ["Account Details", "/account/details"],
  ],
}

const arabic = {
  navigation: "الحساب",
  routes: [
    ["الطلبات", "/account/orders"],
    ["نظرة عامة", "/account"],
    ["المفضلة", "/account/wishlist"],
    ["العناوين", "/account/addresses"],
    ["بيانات الحساب", "/account/details"],
  ],
}

for (const width of [1280, 390]) {
  await checkLocale("", english, width)
  await checkLocale("/ar", arabic, width)
}

for (const prefix of ["", "/ar"]) {
  const page = await browser.newPage()
  await page.goto(`${BASE}${prefix}/account/orders`, {
    waitUntil: "networkidle",
  })
  await page.waitForURL(`**${prefix}/sign-in`)
  await page.close()
}

async function checkSignOutDialog(prefix, copy, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await signInPreview(page)
  await page.goto(`${BASE}${prefix}/account`, { waitUntil: "networkidle" })
  const trigger = page
    .locator(".account-nav__sign-out")
    .getByRole("button", { name: copy.signOut, exact: true })

  await trigger.click()
  const dialog = page.getByRole("dialog", { name: copy.title })
  await dialog.waitFor()
  if (
    !(await dialog
      .getByRole("button", { name: copy.cancel })
      .evaluate((element) => element === document.activeElement))
  )
    throw new Error(`${prefix || "/en"}: dialog did not receive focus`)

  await dialog.getByRole("button", { name: copy.cancel }).click()
  await dialog.waitFor({ state: "hidden" })
  if (
    !(await trigger.evaluate((element) => element === document.activeElement))
  )
    throw new Error(`${prefix || "/en"}: Cancel did not return focus`)

  await trigger.click()
  await page.keyboard.press("Escape")
  await dialog.waitFor({ state: "hidden" })
  if (await dialog.isVisible())
    throw new Error(`${prefix || "/en"}: Escape did not close dialog`)
  if (
    !(await trigger.evaluate((element) => element === document.activeElement))
  )
    throw new Error(`${prefix || "/en"}: Escape did not return focus`)

  await trigger.click()
  await page.mouse.click(2, 2)
  await dialog.waitFor({ state: "hidden" })
  if (await dialog.isVisible())
    throw new Error(`${prefix || "/en"}: backdrop did not close dialog`)

  await trigger.click()
  await dialog.getByRole("button", { name: copy.signOut, exact: true }).click()
  await page.waitForURL(`${BASE}${prefix || "/"}`)
  await page.close()
}

await checkSignOutDialog(
  "",
  { title: "Sign out?", cancel: "Cancel", signOut: "Sign Out" },
  1280,
)
await checkSignOutDialog(
  "/ar",
  { title: "تسجيل الخروج؟", cancel: "إلغاء", signOut: "تسجيل الخروج" },
  390,
)

await browser.close()
if (errors.length) throw new Error(`Console errors:\n${errors.join("\n")}`)
console.log("PASS account navigation stays client-side in English and Arabic")
