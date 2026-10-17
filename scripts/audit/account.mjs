// Account (Step 3A): profile, saved addresses, order-request history and the
// checkout → history snapshot, in English and Arabic. Account data is served
// by the in-memory mock (mockSupabase.mjs); database rules and RLS are
// checked against Postgres in database.mjs.
import {
  BASE,
  appLocation,
  createAccountData,
  createReport,
  launch,
  settle,
  signInPreview,
  trackErrors,
} from "./lib.mjs"

const report = createReport("Account")
const check = (ok, label, detail) => report.check(ok, label, ok ? "" : (detail ?? ""))
const browser = await launch()

async function open(width = 1280) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  trackErrors(page, report.errors)
  return page
}

const section = (page, id) => page.locator(`#account-${id}`)
const headingButton = (page, id) =>
  section(page, id).locator(".account-section__heading button")

for (const lang of ["en", "ar"]) {
  const prefix = lang === "ar" ? "/ar" : ""
  const L = (en, ar) => (lang === "ar" ? ar : en)
  const tag = `[${lang}] `

  // ------------------------------------------------------------ Profile
  {
    const page = await open()
    const data = await signInPreview(page)
    await page.goto(BASE + prefix + "/account", { waitUntil: "networkidle" })
    await settle(page, 300)
    const details = section(page, "details")
    const text = await details.locator(".account-details").textContent()
    check(
      text.includes("Amira Preview") && text.includes("+20 100 000 0000") && text.includes("preview.client@example.com"),
      tag + "details show profile name, phone and session email",
      text,
    )
    await headingButton(page, "details").click()
    const form = details.locator("form.account-form")
    check((await form.locator("input[name=firstName]").inputValue()) === "Amira", tag + "edit form prefilled from the profile")
    check((await form.locator("input[type=email], input[name=email]").count()) === 0, tag + "email is not editable")
    await form.locator("input[name=firstName]").fill("")
    await form.locator("button[type=submit]").click()
    check(
      (await form.locator(".form-field__error").first().textContent()) ===
        L("Please enter your first name.", "يُرجى إدخال اسمك الأول."),
      tag + "profile validation in the page language",
    )
    await form.locator("input[name=firstName]").fill("Nour")
    await form.locator("input[name=phone]").fill("+20 111 222 3333")
    await form.locator("button[type=submit]").click()
    await details.locator(".account-details").waitFor()
    check(
      (await details.locator(".account-status").textContent()) === L("Your details have been saved.", "تم حفظ بياناتك."),
      tag + "profile saved message",
    )
    check(
      (await page.locator("main h1").textContent()) === L("Welcome back, Nour.", "أهلًا بعودتك، Nour."),
      tag + "greeting uses the saved first name",
    )
    const patch = data.writes.find((w) => w.resource === "profiles")
    check(
      patch && Object.keys(patch.body).sort().join() === "first_name,last_name,phone",
      tag + "profile update sends only names and phone",
      patch?.body,
    )
    await page.reload({ waitUntil: "networkidle" })
    await settle(page, 300)
    const after = await details.locator(".account-details").textContent()
    check(after.includes("Nour Preview") && after.includes("+20 111 222 3333"), tag + "profile update persists after refresh")
    await page.close()
  }

  // ---------------------------------------------------------- Addresses
  {
    const page = await open()
    const data = await signInPreview(page)
    await page.goto(BASE + prefix + "/account", { waitUntil: "networkidle" })
    await settle(page, 300)
    const book = section(page, "addresses")
    check((await book.locator(".address-list > li").count()) === 1, tag + "saved address listed")
    check(
      (await book.locator(".account-label").first().textContent()) === L("Default Address · Home", "العنوان الافتراضي · Home"),
      tag + "default address labelled",
    )
    // Add
    await headingButton(page, "addresses").click()
    const form = book.locator("form.account-form")
    check((await form.locator("input[name=fullName]").inputValue()) === "Amira Preview", tag + "new address prefilled with the customer's name")
    check(await form.locator("input[name=label]").evaluate((el) => el === document.activeElement), tag + "address form moves focus to its first field")
    await form.locator("input[name=address]").fill("")
    await form.locator("button[type=submit]").click()
    check((await form.locator(".form-field__error").count()) >= 1, tag + "address validation")
    await form.locator("input[name=label]").fill(L("Office", "العمل"))
    await form.locator("input[name=address]").fill(L("4 Nile Corniche", "٤ كورنيش النيل"))
    await form.locator("input[name=cityArea]").fill(L("Giza", "الجيزة"))
    await form.locator("button[type=submit]").click()
    await book.locator(".address-list").waitFor()
    await settle(page, 200)
    check((await book.locator(".address-list > li").count()) === 2, tag + "address created")
    check((await book.locator(".account-status").textContent()) === L("Address saved.", "تم حفظ العنوان."), tag + "address saved message")
    const created = data.writes.find((w) => w.resource === "addresses" && w.method === "POST")
    check(created && !("user_id" in created.body) && !("id" in created.body), tag + "owner never sent by the client (session decides)", created?.body)
    // Set as default
    await book.getByRole("button", { name: L("Set as default address: Office", "تعيين كعنوان افتراضي: العمل") }).click()
    await settle(page, 300)
    const labels = await book.locator(".account-label").allTextContents()
    check(
      labels[0] === L("Default Address · Office", "العنوان الافتراضي · العمل") && labels.filter((l) => l.includes(L("Default", "الافتراضي"))).length === 1,
      tag + "set default moves the default (exactly one)",
      labels,
    )
    // Edit
    await book.getByRole("button", { name: L("Edit address: Home", "تعديل العنوان: Home") }).click()
    check(await book.locator("input[type=checkbox][name=isDefault]").isEnabled(), tag + "non-default address can be made default from the form")
    await book.locator("form.account-form input[name=cityArea]").fill(L("Cairo, Maadi", "القاهرة، المعادي"))
    await book.locator("form.account-form button[type=submit]").click()
    await settle(page, 300)
    check((await book.locator(".address-list").textContent()).includes(L("Cairo, Maadi", "القاهرة، المعادي")), tag + "address edit persists")
    // Delete (with confirmation) the default → the other becomes default
    await book.getByRole("button", { name: L("Delete address: Office", "حذف العنوان: العمل") }).click()
    check(await book.getByText(L("Delete this address?", "هل تريد حذف هذا العنوان؟")).isVisible(), tag + "delete asks for confirmation")
    await book.getByRole("button", { name: L("Delete Address", "حذف العنوان"), exact: true }).click()
    await settle(page, 300)
    check((await book.locator(".address-list > li").count()) === 1, tag + "address deleted")
    check(
      (await book.locator(".account-label").first().textContent()) === L("Default Address · Home", "العنوان الافتراضي · Home"),
      tag + "deleting the default promotes the remaining address",
    )
    await page.reload({ waitUntil: "networkidle" })
    await settle(page, 300)
    check((await book.locator(".address-list > li").count()) === 1 && (await book.textContent()).includes(L("Cairo, Maadi", "القاهرة، المعادي")), tag + "address changes persist after refresh")
    // Phone stays left to right
    check((await book.locator("address bdi[dir=ltr]").first().textContent()) === "+20 100 000 0000", tag + "address phone isolated LTR")
    await page.close()
  }

  // ------------------------------------------------------------- Orders
  {
    const page = await open()
    const data = createAccountData()
    for (let i = 0; i < 3; i++) data.orders.push({ ...data.orders[1], id: "extra-" + i, reference: `PF-2607${10 + i}-ZZ0${i}`, created_at: new Date(Date.now() - (90 + i) * 86400000).toISOString() })
    await signInPreview(page, data)
    await page.goto(BASE + prefix + "/account", { waitUntil: "networkidle" })
    await settle(page, 300)
    const orders = section(page, "orders")
    check((await orders.locator(".order-list > li").count()) === 3, tag + "three most recent orders shown")
    check((await orders.locator(".order-list__number").first().textContent()) === "PF-260928-K7Q2", tag + "newest order first")
    check((await orders.locator(".order-list__number span[dir=ltr]").count()) === 3, tag + "references stay LTR")
    check(
      (await orders.locator(".order-list__status").first().textContent()) === L("Awaiting store confirmation", "في انتظار تأكيد المتجر"),
      tag + "status wording",
    )
    const first = orders.locator(".order-list > li").first()
    const items = await first.locator(".order-list__items li").allTextContents()
    check(
      items.length === 2 && items[0].includes("Quiet Oud") && items[0].includes(L("75 ml", "75 مل")) && items[0].includes("× 1"),
      tag + "items with size and quantity",
      items,
    )
    const total = await first.locator(".order-list__total").textContent()
    check(total.replace(/\s|‏|‎/g, "").includes(L("$317", "317US$")), tag + "total snapshot", total)
    const viewAll = headingButton(page, "orders")
    check((await viewAll.textContent()).includes(L("View All Orders (5)", "عرض جميع الطلبات (5)")), tag + "view all shows the count")
    await viewAll.click()
    check((await orders.locator(".order-list > li").count()) === 5 && (await viewAll.getAttribute("aria-expanded")) === "true", tag + "view all expands to every order")
    check(!(await page.locator("main").textContent()).match(/Processing|Shipped|Delivered|قيد التجهيز|تم الشحن|تم التوصيل/), tag + "no invented fulfilment statuses")
    await page.close()
  }

  // ---------------------------------------------- Loading error + retry
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const data = createAccountData()
    data.failAll = true
    await signInPreview(page, data)
    await page.goto(BASE + prefix + "/account", { waitUntil: "networkidle" })
    await settle(page, 300)
    const errorTitle = L("This couldn’t be loaded", "تعذّر تحميل هذا القسم")
    check((await page.getByText(errorTitle).count()) === 3, tag + "error state in orders, addresses and details")
    check((await page.locator("main h1").textContent()) === L("Welcome back, Amira.", "أهلًا بعودتك، Amira."), tag + "greeting falls back to sign-up names")
    data.failAll = false
    for (const id of ["orders", "addresses"]) await section(page, id).getByRole("button", { name: L("Try Again", "إعادة المحاولة") }).click()
    await section(page, "details").getByRole("button", { name: L("Try Again", "إعادة المحاولة") }).click()
    await settle(page, 400)
    check((await page.getByText(errorTitle).count()) === 0 && (await page.locator(".order-list > li").count()) === 2, tag + "retry loads the data")
    await page.close()
  }
}

// ------------------------------------------- Checkout → order history
for (const lang of ["en", "ar"]) {
  const prefix = lang === "ar" ? "/ar" : ""
  const tag = `[${lang}] `
  const page = await open()
  const data = await signInPreview(page, createAccountData("empty"))
  await page.route(/wa\.me/, (route) => route.fulfill({ status: 200, body: "blocked" }))
  await page.goto(BASE + "/products", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Add to bag, Quiet Oud" }).click()
  await page.getByRole("button", { name: "Add to bag, Quiet Oud" }).click()
  await page.getByRole("button", { name: "Add to bag, Velvet Iris" }).click()
  if (prefix) {
    await page.evaluate(() => document.querySelector(".header-language a[hreflang=ar]").click())
    await page.waitForURL("**/ar/products")
    await settle(page)
  }
  await page.evaluate(() => document.querySelector(".header-actions a[href$='/cart']").click())
  await settle(page)
  await page.locator(".order-summary__checkout").click()
  await page.waitForURL(`**${prefix}/checkout`)
  await settle(page)
  const f = (n) => page.locator(`form.checkout-form [name=${n}]`)
  check((await f("email").inputValue()) === "preview.client@example.com", tag + "checkout still prefilled from the session")
  await f("phone").fill("+20 100 123 4567")
  await f("address").fill("12 Nile Street")
  await f("cityArea").fill("Cairo")
  await page.locator("form.checkout-form button[type=submit]").click()
  await page.locator(".checkout-confirmation").waitFor()
  await settle(page, 500)
  const reference = (await page.locator(".checkout-confirmation__code").textContent()).trim()
  check(data.rpcCalls.length === 1, tag + "signed-in checkout saves exactly one history record", data.rpcCalls.length)
  const call = data.rpcCalls[0] ?? {}
  check(call.reference === reference && call.locale === lang, tag + "saved with the confirmation reference and language")
  check(
    !("user_id" in call) && !("status" in call) && !("subtotal" in call),
    tag + "client sends no owner, status or totals (database decides)",
    Object.keys(call),
  )
  check(
    call.items?.length === 2 && call.items[0].product_name === "Quiet Oud" && call.items[0].quantity === 2 && call.items[0].unit_price === 179 && call.items[0].size === "75 ml" && call.items[0].image_url.includes("packshots"),
    tag + "order items snapshot (no duplicates, size, quantity, price, image)",
    call.items,
  )
  check((await page.locator(".checkout-confirmation a[href^='https://wa.me/201278166686']").count()) === 1, tag + "WhatsApp action unchanged")
  check(data.writes.filter((w) => w.resource !== "rpc/create_order_request").length === 0, tag + "checkout writes nothing else to the account")
  check((await page.locator(".header-actions a[href$='/cart']").textContent()).match(/[1-9]/) !== null, tag + "bag not cleared by saving history")
  // Edit Details → resubmit: same reference, same single history record.
  await page.locator(".checkout-confirmation__actions button.checkout-link").click()
  check((await f("cityArea").inputValue()) === "Cairo", tag + "Edit Details keeps the entered values")
  await f("cityArea").fill("Giza")
  await page.locator("form.checkout-form button[type=submit]").click()
  await page.locator(".checkout-confirmation").waitFor()
  await settle(page, 500)
  check((await page.locator(".checkout-confirmation__code").textContent()).trim() === reference, tag + "resubmit keeps the same reference")
  check(data.rpcCalls.length === 2 && data.rpcCalls[1].reference === reference && data.rpcCalls[1].city_area === "Giza", tag + "resubmit sends the edit under the same reference")
  check(data.orders.length === 1 && data.orders[0].city_area === "Giza", tag + "still one history record, updated", data.orders.length)
  const wa = decodeURIComponent(await page.locator(".checkout-confirmation a[href^='https://wa.me/']").getAttribute("href"))
  const mail = decodeURIComponent(await page.locator(".checkout-confirmation a[href^='mailto:']").getAttribute("href"))
  check(wa.includes(reference) && wa.includes("Giza") && mail.includes(reference) && mail.includes("Giza"), tag + "WhatsApp message and email draft use the same reference and the edit")
  await page.goto(BASE + prefix + "/account", { waitUntil: "networkidle" })
  await settle(page, 400)
  check((await section(page, "orders").locator(".order-list__number").first().textContent()) === reference, tag + "new order appears in Account → Orders")
  await page.close()
}

// Checkout prefill from the profile and the default address (signed in only).
async function toCheckout(page) {
  await page.goto(BASE + "/products", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Add to bag, Quiet Oud" }).click()
  await page.evaluate(() => document.querySelector(".header-actions a[href$='/cart']").click())
  await settle(page)
  await page.locator(".order-summary__checkout").click()
  await page.waitForURL("**/checkout")
}
const checkoutValues = (page) =>
  page.evaluate(() => Object.fromEntries([...document.querySelectorAll("form.checkout-form [name]")].map((el) => [el.name, el.value])))
{
  const page = await open()
  const data = await signInPreview(page) // profile with phone + default address
  await toCheckout(page)
  await settle(page, 400)
  let v = await checkoutValues(page)
  check(
    v.fullName === "Amira Preview" && v.phone === "+20 100 000 0000" && v.email === "preview.client@example.com" && v.address === "18 Garden Promenade" && v.cityArea === "Cairo, Zamalek" && v.notes === "",
    "prefill: profile name/phone, session email, default address",
    v,
  )
  check(
    (await page.locator("form.checkout-form [name=phone]").getAttribute("dir")) === "ltr" && (await page.locator("form.checkout-form [name=email]").getAttribute("dir")) === "ltr",
    "prefill: phone and email fields stay LTR",
  )
  // Language switch keeps typed and prefilled values.
  await page.locator("form.checkout-form [name=notes]").fill("Ring twice")
  await page.locator("form.checkout-form [name=address]").fill("22 Typed Road")
  await page.evaluate(() => document.querySelector(".header-language a[hreflang=ar]").click())
  await page.waitForURL("**/ar/checkout")
  await settle(page, 400)
  const ar = await checkoutValues(page)
  await page.evaluate(() => document.querySelector(".header-language a[hreflang=en]").click())
  await page.waitForURL((url) => url.pathname === "/checkout")
  await settle(page, 400)
  const en = await checkoutValues(page)
  check(ar.notes === "Ring twice" && ar.address === "22 Typed Road" && ar.fullName === "Amira Preview" && JSON.stringify(en) === JSON.stringify(ar), "EN → AR → EN keeps every checkout value", { ar, en })
  check(data.writes.length === 0, "prefill writes nothing")
  await page.close()
}
{
  const page = await open()
  const data = createAccountData("empty")
  data.profile.phone = "+20 122 000 1111"
  await signInPreview(page, data) // profile, no saved address
  await toCheckout(page)
  await settle(page, 400)
  const v = await checkoutValues(page)
  check(v.fullName === "Amira Preview" && v.phone === "+20 122 000 1111" && v.email === "preview.client@example.com" && v.address === "" && v.cityArea === "", "prefill without a saved address: name, phone, email only", v)
  await page.close()
}
{
  const page = await open()
  const data = createAccountData()
  data.delayMs = 1500
  await signInPreview(page, data)
  await toCheckout(page)
  await page.locator("form.checkout-form [name=fullName]").waitFor()
  await page.locator("form.checkout-form [name=fullName]").fill("Typed Name")
  await page.locator("form.checkout-form [name=address]").fill("x")
  await page.locator("form.checkout-form [name=address]").fill("")
  await page.waitForTimeout(2500)
  const v = await checkoutValues(page)
  check(v.fullName === "Typed Name" && v.address === "" && v.phone === "+20 100 000 0000" && v.cityArea === "Cairo, Zamalek", "prefill never overwrites typed (or deliberately cleared) fields", v)
  await page.close()
}

// Guest checkout: works, and nothing is saved anywhere.
{
  const page = await open()
  const rest = []
  page.on("request", (request) => {
    if (request.url().includes("/rest/v1/")) rest.push(request.url())
  })
  await page.route("**/rest/v1/**", (route) => route.abort())
  await page.goto(BASE + "/products", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Add to bag, Quiet Oud" }).click()
  await page.evaluate(() => document.querySelector(".header-actions a[href$='/cart']").click())
  await settle(page)
  await page.locator(".order-summary__checkout").click()
  await page.waitForURL("**/checkout")
  await settle(page)
  const f = (n) => page.locator(`form.checkout-form [name=${n}]`)
  await f("fullName").fill("Guest Buyer")
  await f("phone").fill("+20 100 123 4567")
  await f("email").fill("guest@example.com")
  await f("address").fill("1 Street")
  await f("cityArea").fill("Cairo")
  await page.locator("form.checkout-form button[type=submit]").click()
  await page.locator(".checkout-confirmation").waitFor()
  await settle(page, 400)
  check((await page.locator(".checkout-confirmation a[href^='https://wa.me/']").count()) === 1, "guest checkout still works (no sign-in needed)")
  check(rest.length === 0, "guest order is not saved to any account", rest)
  await page.close()
}

// Sign-out protects account data.
{
  const page = await open()
  await signInPreview(page)
  await page.goto(BASE + "/account", { waitUntil: "networkidle" })
  await settle(page, 300)
  check((await page.locator(".order-list > li").count()) === 2, "signed in: account data shown")
  await page.getByRole("button", { name: "Sign Out" }).click()
  await settle(page, 400)
  // In-app navigation: a full reload would re-run the preview sign-in script.
  await page.evaluate(() => {
    history.pushState(null, "", "/account")
    dispatchEvent(new PopStateEvent("popstate"))
  })
  await settle(page, 400)
  check((await appLocation(page)) === "/sign-in" && (await page.locator(".order-list, .address-list").count()) === 0, "after sign-out, /account shows no account data")
  await page.close()
}

// Language switch keeps the session and the account data.
{
  const page = await open()
  await signInPreview(page)
  await page.goto(BASE + "/account", { waitUntil: "networkidle" })
  await settle(page, 300)
  await page.evaluate(() => document.querySelector(".header-language a[hreflang=ar]").click())
  await page.waitForURL("**/ar/account")
  await settle(page, 400)
  check(
    (await page.locator(".order-list__status").first().textContent()) === "في انتظار تأكيد المتجر" &&
      (await page.locator(".address-list > li").count()) === 1,
    "switching to Arabic keeps the session and account data",
  )
  await page.close()
}

await browser.close()
report.finish()
