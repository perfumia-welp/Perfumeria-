// State flows: bag, product filters/sort/URL state, search overlay, forms, account.
import {
  appLocation,
  BASE,
  createReport,
  createAccountData,
  fillBag,
  launch,
  PREVIEW_USER,
  settle,
  signInPreview,
  trackErrors,
} from "./lib.mjs"

const report = createReport("State flows")
const { check } = report
const browser = await launch()
const open = async (width = 1440) => {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  trackErrors(page, report.errors)
  return page
}
const money = (text) => Number(String(text).replace(/[^0-9.]/g, ""))

// ---------------------------------------------------------------- Bag
let p = await open()
await p.goto(BASE + "/products", { waitUntil: "networkidle" })
const badge = () => p.locator(".icon-button__badge").textContent()
const add = (name) =>
  p.getByRole("button", { name: `Add to bag, ${name}` }).click()
check((await badge()) === "0", "bag starts empty")
await add("Velvet Iris")
await add("Velvet Iris")
check((await badge()) === "2", "adding the same product twice merges (badge 2)")
await add("Quiet Oud")
await add("Amber Reverie")
check((await badge()) === "4", "adding different products (badge 4)")
await p
  .locator(".main-nav")
  .getByRole("link", { name: "About", exact: true })
  .click()
await p
  .locator(".main-nav")
  .getByRole("link", { name: "Home", exact: true })
  .click()
check((await badge()) === "4", "bag persists across navigation")
await p.locator('.header-actions a[href$="/cart"]').click()
await p.waitForTimeout(250)

const lines = () =>
  p.evaluate(() =>
    [...document.querySelectorAll(".cart-line")].map((line) => ({
      name: line.querySelector("h2").textContent,
      qty: Number(
        line.querySelector(".quantity-control").innerText.match(/\d+/)[0],
      ),
      price: line.querySelector(".cart-line__price").firstChild.textContent,
    })),
  )
const totalsConsistent = async (label) => {
  const items = await lines()
  const s = await p.evaluate(() => ({
    subtotal: document.querySelector(".order-summary__rows dd").textContent,
    total: document.querySelector(".order-summary__total strong").textContent,
    bar: document.querySelector(".mobile-checkout__bar strong").textContent,
    meta: document.querySelector(".page-intro__meta").textContent,
    badge: document.querySelector(".icon-button__badge").textContent,
  }))
  const expected = items.reduce((t, i) => t + money(i.price) * i.qty, 0)
  const qty = items.reduce((t, i) => t + i.qty, 0)
  check(
    [s.subtotal, s.total, s.bar].every((v) => money(v) === expected) &&
      Number(s.badge) === qty &&
      s.meta.startsWith(String(qty)),
    `totals consistent: ${label}`,
    `${s.total}, ${qty} items`,
  )
}
const quantityButton = (name, label) =>
  p.getByRole("group", { name: `Quantity, ${name}` }).getByRole("button", {
    name: label,
  })

check(
  (await lines()).map((l) => `${l.name}×${l.qty}`).join() ===
    "Velvet Iris×2,Quiet Oud×1,Amber Reverie×1",
  "bag lines",
)
await totalsConsistent("initial")
// Limit buttons use aria-disabled (to keep focus), so press them via the keyboard.
await quantityButton("Quiet Oud", "Increase quantity").focus()
for (let i = 0; i < 12; i++) await p.keyboard.press("Enter")
check(
  (await lines())[1].qty === 10 &&
    (await quantityButton("Quiet Oud", "Increase quantity").getAttribute(
      "aria-disabled",
    )) === "true",
  "maximum quantity 10",
)
await totalsConsistent("at maximum")
await quantityButton("Quiet Oud", "Decrease quantity").focus()
for (let i = 0; i < 12; i++) await p.keyboard.press("Enter")
check(
  (await lines())[1].qty === 1 &&
    (await p.evaluate(() =>
      document.activeElement.getAttribute("aria-label"),
    )) === "Decrease quantity",
  "minimum quantity 1, focus kept",
)
await p.getByRole("button", { name: "Remove Quiet Oud" }).click()
await p.waitForTimeout(100)
check(
  (await lines()).length === 2 &&
    (await p.evaluate(() => document.activeElement.textContent)) === "Undo",
  "remove → focus on Undo",
)
await totalsConsistent("after remove")
await p.keyboard.press("Enter")
await p.waitForTimeout(100)
check(
  (await lines())[1]?.name === "Quiet Oud" &&
    (await p.evaluate(() =>
      document.activeElement.getAttribute("aria-label"),
    )) === "Remove Quiet Oud",
  "Undo restores line in place, focus on its Remove",
)
await totalsConsistent("after undo")
await p.getByRole("button", { name: /Have a promo code/ }).click()
await p.getByLabel("Promo code").fill("TEST")
await p.getByRole("button", { name: "Apply" }).click()
await p.waitForTimeout(50)
check(
  (
    await p.locator(".order-summary__promo .order-summary__note").textContent()
  ).includes("can’t be applied yet"),
  "promo: honest unavailable message",
)
await p.getByRole("button", { name: /Proceed to Checkout/ }).click()
await p.waitForTimeout(150)
check(
  (await appLocation(p)) === "/checkout",
  "checkout: Proceed to Checkout opens /checkout",
)
await p.getByRole("link", { name: "Back to Bag" }).click()
await p.waitForTimeout(150)
check(
  (await appLocation(p)) === "/cart" &&
    (await p.getByLabel("Promo code").inputValue()) === "TEST",
  "checkout: back to the bag keeps the entered promo code",
)
for (const name of ["Velvet Iris", "Quiet Oud", "Amber Reverie"])
  await p.getByRole("button", { name: `Remove ${name}` }).click()
await p.waitForTimeout(100)
check(
  (await p.locator("main h1").textContent()) ===
    "A signature scent is still waiting for you." && (await badge()) === "0",
  "removing the last item shows the empty bag",
)
check(
  (await p.locator(".cart-undo").count()) === 1,
  "empty bag still offers Undo",
)
await p.close()

// Mobile sticky checkout bar.
p = await open(390)
await fillBag(p, ["Velvet Iris", "Santal Lumière", "Amber Reverie"])
const barHidden = () =>
  p.evaluate(() =>
    document.querySelector(".mobile-checkout").classList.contains("is-hidden"),
  )
check(
  !(await barHidden()),
  "mobile checkout bar visible while browsing the bag",
)
await p.locator(".order-summary__checkout").scrollIntoViewIfNeeded()
await p.waitForTimeout(400)
check(
  await barHidden(),
  "mobile bar hides while the summary checkout is visible",
)
await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
await p.waitForTimeout(300)
check(
  await p.evaluate(
    () =>
      document.querySelector(".mobile-checkout").getBoundingClientRect()
        .bottom <=
      document.querySelector("footer").getBoundingClientRect().top + 1,
  ),
  "mobile bar never covers the footer",
)
await p.close()

// ---------------------------------------------------------------- Products
p = await open()
const listing = async () => ({
  query: (await appLocation(p)).replace("/products", ""),
  count: await p.locator(".page-intro__meta").textContent(),
  names: await p.locator(".product-card__name").allTextContents(),
})
const choose = async (menu, role, name) => {
  await p
    .locator(".product-toolbar__filters .filter-menu__button", {
      hasText: menu,
    })
    .click()
  await p.getByRole(role, { name }).click()
  await p.keyboard.press("Escape")
  await p.waitForTimeout(120)
}
await p.goto(BASE + "/products", { waitUntil: "networkidle" })
check((await listing()).count === "8 Fragrances", "all products listed")
await choose("Gender", "checkbox", /^Men/)
check(
  (await listing()).query === "?gender=men" &&
    (await listing()).count === "3 Fragrances",
  "Gender filter + URL",
)
await choose("Fragrance Family", "checkbox", /^Woody/)
check(
  (await listing()).names.join() === "Quiet Oud,Cedar Veil",
  "combined filters",
)
await choose("Availability", "radio", /^Out of Stock/)
check(
  (await p.locator(".catalogue__empty").count()) === 1 &&
    (await listing()).count === "0 Fragrances",
  "no-results state",
)
await choose("Availability", "radio", /^All/)
await choose("Price", "radio", /^Over \$175/)
check((await listing()).names.join() === "Quiet Oud", "Price filter")
await p.locator(".product-toolbar__sort .filter-menu__button").click()
await p.getByRole("radio", { name: "Name: A–Z" }).click()
await p.waitForTimeout(120)
check((await listing()).query.includes("sort=name"), "Sort written to URL")
for (let i = 0; i < 3; i++) await p.goBack()
await p.waitForTimeout(250)
check(
  (await listing()).query ===
    "?gender=men&family=woody&availability=out-of-stock",
  "Back restores filter state",
  (await listing()).query,
)
await p.goForward()
await p.waitForTimeout(200)
check(
  (await listing()).query === "?gender=men&family=woody",
  "Forward restores filter state",
)
await p.getByRole("button", { name: "Clear all" }).click()
await p.waitForTimeout(120)
check(
  (await listing()).count === "8 Fragrances" && (await listing()).query === "",
  "Clear all",
)
await p.goto(BASE + "/products?sort=price-desc", { waitUntil: "networkidle" })
const prices = (
  await p.locator(".product-card__current-price").allTextContents()
).map(money)
check(
  prices.every((v, i) => i === 0 || prices[i - 1] >= v),
  "price high→low order",
)
await p.goto(BASE + "/products?page=9&gender=bogus", {
  waitUntil: "networkidle",
})
check(
  (await listing()).count === "8 Fragrances" &&
    (await p.locator(".pagination").count()) === 0,
  "invalid params ignored; no pagination when one page",
)
await p.close()

// ---------------------------------------------------------------- Search
p = await open()
await p.goto(BASE + "/about", { waitUntil: "networkidle" })
const searchButton = p
  .locator(".header-actions")
  .getByRole("button", { name: "Search" })
const searchOpen = () =>
  p.evaluate(() => document.getElementById("site-search").open)
await searchButton.click()
await p.waitForTimeout(300)
check(
  (await searchOpen()) &&
    (await p.evaluate(() => document.activeElement.id)) === "site-search-input",
  "search opens with focus in the field",
)
check(
  (await p.locator(".search-overlay__popular button").count()) > 0,
  "popular searches shown",
)
await p.locator("#site-search-input").fill("rose")
check(
  (await p.locator(".search-result__name").allTextContents()).join() ===
    "Nocturne Rose",
  "live results are genuine matches only",
)
await p.locator("#site-search-input").fill("qwerty")
check(
  (await p.locator(".search-overlay__empty").count()) === 1,
  "search no-results state",
)
await p.keyboard.press("Escape")
await p.waitForTimeout(300)
check(
  !(await searchOpen()) &&
    (await appLocation(p)) === "/about" &&
    (await p.evaluate(() => document.activeElement.textContent.trim())) ===
      "Search",
  "Esc closes, focus returns to Search, page kept",
)
await searchButton.click()
await p.waitForTimeout(300)
await p.mouse.click(700, 880)
await p.waitForTimeout(300)
check(!(await searchOpen()), "backdrop click closes")
await searchButton.click()
await p.waitForTimeout(300)
await p.keyboard.type("woody")
await p.keyboard.press("Enter")
await p.waitForTimeout(300)
check(
  (await appLocation(p)) === "/products?q=woody" && !(await searchOpen()),
  "Enter opens /products?q=…",
)
await searchButton.click()
await p.waitForTimeout(300)
await p.keyboard.type("amber")
await p.getByRole("link", { name: /View all results/ }).click()
await p.waitForTimeout(300)
check((await appLocation(p)) === "/products?q=amber", "View all results")
await p.close()
p = await open(390)
await p.goto(BASE + "/", { waitUntil: "networkidle" })
await p
  .locator(".header-actions")
  .getByRole("button", { name: "Search" })
  .click()
await p.waitForTimeout(350)
check(
  await p.evaluate(() => {
    const r = document.getElementById("site-search").getBoundingClientRect()
    return r.top === 0 && r.height === innerHeight
  }),
  "search is full-screen on mobile",
)
await p.close()

// ---------------------------------------------------------------- Forms
p = await open()
await p.goto(BASE + "/contact", { waitUntil: "networkidle" })
const form = p.locator(".contact-form")
await form.getByRole("button", { name: "Send Message" }).click()
check(
  (await form.locator("[aria-invalid=true]").count()) === 4 &&
    (await p.evaluate(() => document.activeElement.name)) === "fullName",
  "contact: required-field errors, focus on first",
)
await form.getByLabel("Full Name").fill("Test")
await form.getByLabel("Email Address").fill("test@example.com")
await form.getByLabel("Subject").fill("Hello")
await form.getByLabel("Message").fill("Message")
await form.getByRole("button", { name: "Send Message" }).click()
await p.waitForTimeout(100)
check(
  (await p.locator(".contact-form__status").textContent()).startsWith(
    "Contact submission is not available yet",
  ),
  "contact: honest unavailable message",
)

// The form against a stand-in for POST /api/contact (server.mjs): no email
// is sent. Checks the payload, the sending state, one request per click,
// failure with retry, the rate-limit message and the reset after success.
{
  const cp = await open()
  const requests = []
  let reply = { status: 502, body: { ok: false, error: "send_failed" } }
  let release
  /** Answers request number n once it has arrived. */
  const respond = async (n) => {
    while (requests.length < n) await cp.waitForTimeout(20)
    release()
  }
  await cp.route("**/api/contact", async (route) => {
    requests.push(JSON.parse(route.request().postData() || "{}"))
    await new Promise((resolve) => (release = resolve))
    await route.fulfill({
      status: reply.status,
      contentType: "application/json",
      body: JSON.stringify(reply.body),
    })
  })
  await cp.goto(BASE + "/contact?topic=wholesale", { waitUntil: "networkidle" })
  const cf = cp.locator(".contact-form")
  const status = cf.locator(".contact-form__status")
  await cf.getByLabel("Full Name").fill("Test Buyer")
  await cf.getByLabel("Email Address").fill("buyer@example.com")
  await cf.getByLabel("Message").fill("Prices for 50 bottles?")
  const send = cf.locator("button[type=submit]")
  await send.click()
  await cp.waitForFunction(() =>
    document.querySelector(".contact-form button[type=submit]").disabled,
  )
  await send.dispatchEvent("click")
  check(
    (await send.textContent()).includes("Sending") &&
      (await status.textContent()) === "Sending your message…",
    "contact: sending state while the request runs",
  )
  await respond(1)
  await cp.waitForFunction(
    () =>
      !document.querySelector(".contact-form button[type=submit]").disabled,
  )
  check(requests.length === 1, "contact: one request per submit", requests.length)
  const sent = requests[0] ?? {}
  check(
    sent.topic === "wholesale" &&
      sent.locale === "en" &&
      sent.subject === "Wholesale inquiry" &&
      sent.nectar === "" &&
      sent.pageUrl?.endsWith("/contact?topic=wholesale"),
    "contact: payload carries topic, locale, page and empty trap",
    sent,
  )
  check(
    (await status.textContent()).startsWith(
      "Your message could not be sent",
    ) &&
      (await cf.getByLabel("Message").inputValue()) ===
        "Prices for 50 bottles?",
    "contact: failure keeps the message for a retry",
  )

  reply = { status: 429, body: { ok: false, error: "rate_limited" } }
  await send.click()
  await respond(2)
  await cp.waitForFunction(
    () =>
      !document.querySelector(".contact-form button[type=submit]").disabled,
  )
  check(
    (await status.textContent()).startsWith("You have sent several messages"),
    "contact: rate-limit message",
  )

  reply = { status: 200, body: { ok: true } }
  await send.click()
  await respond(3)
  await cp.waitForFunction(
    () =>
      !document.querySelector(".contact-form button[type=submit]").disabled,
  )
  check(
    (await status.textContent()) === "Thank you. Your message has been sent." &&
      (await cf.getByLabel("Message").inputValue()) === "" &&
      (await cf.getByLabel("Full Name").inputValue()) === "" &&
      (await cf.getByLabel("Subject").inputValue()) === "Wholesale inquiry" &&
      (await appLocation(cp)) === "/contact?topic=wholesale",
    "contact: success clears the form and stays on the page",
  )
  check(requests.length === 3, "contact: retry sends again", requests.length)

  // Arabic: localized status, Arabic locale in the payload.
  reply = { status: 502, body: { ok: false, error: "send_failed" } }
  await cp.goto(BASE + "/ar/contact?topic=track-order", {
    waitUntil: "networkidle",
  })
  const af = cp.locator(".contact-form")
  await af.getByLabel("الاسم الكامل").fill("نور")
  await af.getByLabel("البريد الإلكتروني").fill("nour@example.com")
  await af.getByLabel("الرسالة").fill("طلب رقم PF-1")
  await af.locator("button[type=submit]").click()
  await respond(4)
  await cp.waitForFunction(
    () =>
      !document.querySelector(".contact-form button[type=submit]").disabled,
  )
  const arSent = requests.at(-1)
  check(
    arSent.locale === "ar" &&
      arSent.topic === "track-order" &&
      (await af.locator(".contact-form__status").textContent()).startsWith(
        "تعذّر إرسال رسالتك",
      ),
    "contact: Arabic payload and Arabic error text",
    arSent,
  )
  await cp.close()
}
const newsletter = p.locator(".newsletter-form")
await newsletter
  .getByRole("button", { name: "Subscribe to newsletter" })
  .click()
check(
  (await newsletter.locator(".newsletter-form__message").textContent()) ===
    "Please enter your email address.",
  "newsletter: empty",
)
await newsletter.getByLabel("Email address").fill("bad@")
await newsletter.getByLabel("Email address").press("Enter")
check(
  (await newsletter.locator(".newsletter-form__message").textContent()) ===
    "Please enter a valid email address.",
  "newsletter: invalid",
)
await newsletter.getByLabel("Email address").fill("a@example.com")
await newsletter.getByLabel("Email address").press("Enter")
await p.waitForTimeout(100)
check(
  (
    await newsletter.locator(".newsletter-form__message").textContent()
  ).startsWith("Newsletter sign-up is not open yet"),
  "newsletter: honest unavailable message",
)
await p.close()

// ---------------------------------------------------------------- Product page + wishlist
p = await open()
await p.goto(BASE + "/products", { waitUntil: "networkidle" })
await p.getByRole("button", { name: "Save to wishlist, Velvet Iris" }).click()
await p.waitForTimeout(100)
check(
  (await p.getByRole("button", { name: "Remove from wishlist, Velvet Iris" }).count()) === 1,
  "wishlist: heart saves from the grid",
)
await p.reload({ waitUntil: "networkidle" })
check(
  (await p.getByRole("button", { name: "Remove from wishlist, Velvet Iris" }).count()) === 1,
  "wishlist: persists after refresh",
)
await p.evaluate(() =>
  localStorage.setItem("perfumeria:wishlist", '["velvet-iris","velvet-iris","gone",5]'),
)
await p.goto(BASE + "/wishlist", { waitUntil: "networkidle" })
check(
  JSON.stringify(await p.locator(".product-card__name").allInnerTexts()) === '["Velvet Iris"]',
  "wishlist: duplicates and unknown ids ignored",
)
await p.getByRole("link", { name: "Velvet Iris", exact: true }).click()
await settle(p)
check(
  (await appLocation(p)) === "/products/velvet-iris" &&
    /^Velvet Iris( \d+ ml)? – Price & Details \| Perfumira$/.test(await p.title()),
  "wishlist item opens the product page (slug URL, title)",
)
await p.getByRole("button", { name: "Remove from Wishlist" }).click()
await p.goto(BASE + "/wishlist", { waitUntil: "networkidle" })
check(
  (await p.getByText("Your wishlist is empty.").count()) === 1,
  "wishlist: product-page removal and empty state",
)
await p.goto(BASE + "/products/santal-lumiere", { waitUntil: "networkidle" })
await p.getByRole("button", { name: "Increase quantity" }).click()
await p.getByRole("button", { name: "Increase quantity" }).click()
await p.getByRole("button", { name: /^Add to Bag/ }).click()
check((await p.locator(".icon-button__badge").textContent()) === "3", "product page adds the chosen quantity")
await p.goto(BASE + "/products/eau-de-minuit", { waitUntil: "networkidle" })
check(
  (await p.getByRole("button", { name: /^Add to Bag/ }).count()) === 0,
  "out-of-stock product page offers no Add to Bag",
)
await p.locator(".header-actions").getByRole("button", { name: "Search" }).click()
await p.waitForTimeout(350)
await p.keyboard.type("oud")
await p.locator(".search-result").first().click()
await settle(p)
check((await appLocation(p)) === "/products/quiet-oud", "search result opens its product page")
await p.goto(BASE + "/products", { waitUntil: "networkidle" })
await p.getByRole("link", { name: "Cedar Veil", exact: true }).click()
await settle(p)
check((await appLocation(p)) === "/products/cedar-veil", "grid name opens the product page")
await p.close()

// ---------------------------------------------------------------- Account
// Signed out: /account is protected and returns there after sign-in.
p = await open()
await p.goto(BASE + "/account", { waitUntil: "networkidle" })
check((await appLocation(p)) === "/sign-in", "account redirects to sign-in when signed out")
await p.close()

// Signed in (fake local session, mocked account data): identity, wishlist,
// order history and saved addresses. Account editing is in account.mjs.
p = await open()
await signInPreview(p)
await p.goto(BASE + "/products", { waitUntil: "networkidle" })
await p.getByRole("button", { name: "Save to wishlist, Quiet Oud" }).click()
await p.goto(BASE + "/account", { waitUntil: "networkidle" })
await p.waitForTimeout(300)
check(
  (await p.locator("main h1").textContent()) === `Welcome back, ${PREVIEW_USER.firstName}.`,
  "account overview greets the signed-in client",
)
// Details, orders and addresses have their own account pages.
await p.goto(BASE + "/account/details", { waitUntil: "networkidle" })
check(
  (await p.locator(".account-details").textContent()).includes(PREVIEW_USER.email),
  "account details show the session email",
)
await p.goto(BASE + "/account/orders", { waitUntil: "networkidle" })
await p.locator(".order-list > li").first().waitFor()
const orderCount = await p.locator(".order-list > li").count()
check(
  (await p.locator(".order-list__status").first().textContent()) ===
    "Awaiting store confirmation",
  "order status is the request status only",
)
await p.goto(BASE + "/account/addresses", { waitUntil: "networkidle" })
await p.locator(".address-list > li").first().waitFor()
check(
  orderCount === 2 && (await p.locator(".address-list > li").count()) === 1,
  "account shows order history and saved addresses",
)
await p.goto(BASE + "/account", { waitUntil: "networkidle" })
await p.locator("#account-wishlist .wishlist-preview a").first().click()
await settle(p)
check(
  (await appLocation(p)) === "/products/quiet-oud",
  "account wishlist item opens its product page",
)
await p.goto(BASE + "/account", { waitUntil: "networkidle" })
// Sign Out asks for confirmation in a dialog first.
await p.getByRole("button", { name: "Sign Out" }).first().click()
await p.getByRole("dialog").getByRole("button", { name: "Sign Out" }).click()
await settle(p, 400)
check((await appLocation(p)) === "/", "Sign Out returns to the homepage")
await p.close()
p = await open()
await signInPreview(p, createAccountData("empty"))
await p.goto(BASE + "/account", { waitUntil: "networkidle" })
await p.waitForTimeout(300)
// A new account: no orders, no addresses, empty wishlist on this device.
check(
  (await p.locator(".account-empty").count()) === 3,
  "account empty states (new account)",
)
await p.close()

await browser.close()
report.finish()
