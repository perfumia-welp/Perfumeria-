import assert from "node:assert/strict"
import { test } from "node:test"
import nodemailer from "nodemailer"
import { createApp as createAppWith } from "./app.mjs"
import { createHash } from "node:crypto"
import { verifyOrder as verifyOrderWith, createOrderHandler as createOrderHandlerWith, createOrderLookupHandler, buildOrderEmail, orderFingerprint, englishOptionLabel, ORDER_CURRENCY, ORDER_TAX } from "./orders.mjs"

// The minimum order comes from Welp at run time (server/orderRules.mjs). These
// tests fix it at a Welp value of EGP 1,000 through the same injection points
// production uses; server/orderRules.test.mjs covers other values, the cache
// and failures.
const MIN_1000 = async () => ({ minimumOrderSubtotal: 1000 })
const verifyOrder = (input, user, getProduct, getArabicNames, getRules = MIN_1000) => verifyOrderWith(input, user, getProduct, getArabicNames, getRules)
const createOrderHandler = (options) => createOrderHandlerWith({ getRules: MIN_1000, ...options })
const createApp = (options) => createAppWith({ orderRules: { get: MIN_1000 }, ...options })

const MAIL = { from: "Perfumira Test <from@example.test>", to: "orders@example.test" }
const user = { id: "11111111-1111-1111-1111-111111111111" }
// Shaped like the live catalogue: English product name, Arabic option labels, no currency field.
// Prices keep these orders above the EGP 1,000 minimum used in this file.
const product = { id: 14106, name: "Real catalogue name", price_after_discount: "500.00", image: "https://example.test/bottle.png", is_available: true,
  variations: [{ id: 3, name: "اختار", is_required: true, is_main_price: true, options: [{ id: 4, name: "بالعلبه", price_after_discount: "520.50" }, { id: 5, name: "بدون علبة", price_after_discount: "500.00" }] }] }
const input = () => ({ reference: "PF-261022-AAAA", locale: "en", customer: { fullName: "Test Buyer", phone: "+201001234567", email: "test@example.com", userId: "spoof" },
  delivery: { address: "Test address 12", cityArea: "Test city" }, currency: "EGP", displayedTotal: 1041,
  lines: [{ welpProductId: 14106, productId: "spoof", name: "Invented", nameAr: "مزيف", options: [{ variationId: 3, optionId: 4, label: "Invented" }], unitPrice: 520.50, quantity: 2 }] })
const getProduct = async () => structuredClone(product)
test("authoritative names, prices, IDs, option labels, quantity and owner", async () => {
  const order = await verifyOrder(input(), user, getProduct)
  assert.equal(order.customer.userId, user.id)
  assert.equal(order.lines[0].name, "Real catalogue name (With box)")
  assert.equal(order.lines[0].nameAr, "Real catalogue name (بالعلبه)")
  assert.deepEqual(order.lines[0].options, [{ variationId: 3, optionId: 4, label: "With box", labelAr: "بالعلبه" }])
  assert.equal(order.lines[0].productId, "14106~4")
  assert.equal(order.subtotal, 1041)
  assert.equal(order.currency, "EGP")
})
test("approved Arabic names are used for display; English stays the canonical name", async () => {
  const order = await verifyOrder({ ...input(), locale: "ar" }, user, getProduct, async () => new Map([[14106, "اسم معتمد"]]))
  assert.equal(order.lines[0].name, "Real catalogue name (With box)")
  assert.equal(order.lines[0].nameAr, "اسم معتمد (بالعلبه)")
})
test("Arabic option labels map to the storefront English", () => {
  assert.equal(englishOptionLabel("بدون علبة"), "Without box")
  assert.equal(englishOptionLabel("بالعلبة"), "With box")
  assert.equal(englishOptionLabel("بالعلبه"), "With box")
  assert.equal(englishOptionLabel("حجم خاص"), "حجم خاص")
})
for (const [name, change, code] of [
  ["manipulated price", (r) => r.lines[0].unitPrice = 1, "price_changed"],
  ["changed total", (r) => r.displayedTotal = 1, "price_changed"],
  ["browser currency", (r) => r.currency = "USD", "price_changed"],
  ["invalid product", (r) => r.lines[0].welpProductId = "../1", "invalid_order"],
  ["invalid option", (r) => r.lines[0].options[0].optionId = 99, "invalid_option"],
  ["invalid variation", (r) => r.lines[0].options[0].variationId = 99, "invalid_option"],
  ["required selection", (r) => r.lines[0].options = [], "option_required"],
  ["duplicate choice", (r) => r.lines[0].options.push(r.lines[0].options[0]), "invalid_option"],
  ["duplicate line", (r) => r.lines.push(r.lines[0]), "duplicate_line"],
  ["negative quantity", (r) => r.lines[0].quantity = -1, "invalid_order"],
  ["fractional quantity", (r) => r.lines[0].quantity = 1.5, "invalid_order"],
  ["quantity over bag maximum", (r) => r.lines[0].quantity = 11, "invalid_order"],
  ["header injection", (r) => r.customer.email = "a@b.com\r\nBcc: victim@b.com", "invalid_order"],
]) test(name, async () => {
  const request = input(); change(request)
  await assert.rejects(verifyOrder(request, user, getProduct), (e) => e.code === code)
})
test("changed price response includes reviewed authoritative total and can be confirmed", async () => {
  const changed = async () => ({ ...product, variations: [], price_after_discount: 530 })
  const request = input(); request.lines[0].options = []
  let quote
  await assert.rejects(verifyOrder(request, user, changed), (e) => { quote = e.extra.order; return e.code === "price_changed" })
  assert.equal(quote.displayedTotal, 1060)
  assert.equal((await verifyOrder(quote, user, changed)).subtotal, 1060)
})
test("stock change blocks acceptance and names the product in both languages", async () => {
  await assert.rejects(verifyOrder(input(), user, async () => ({ ...product, is_available: false }), async () => new Map([[14106, "اسم معتمد"]])),
    (e) => e.code === "unavailable_product" && e.status === 409 && e.extra.name === "Real catalogue name" && e.extra.nameAr === "اسم معتمد")
})
test("guest receives same verified snapshot without claiming an account owner", async () => {
  assert.equal((await verifyOrder(input(), { ...user, is_anonymous: true }, getProduct)).customer.userId, null)
})
test("plain products need no option; missing option detail fails closed", async () => {
  const request = input(); request.lines[0].options = []; request.lines[0].unitPrice = 500; request.displayedTotal = 1000
  assert.equal((await verifyOrder(request, user, async () => ({ ...product, variations: [] }))).subtotal, 1000)
  await assert.rejects(verifyOrder(request, user, async () => ({ ...product, variations: [], is_variation_available: true })), (e) => e.code === "catalogue_unavailable")
})
test("email uses the configured addresses, escapes HTML and renders offline", async () => {
  const order = await verifyOrder(input(), user, getProduct); order.notes = '<script>alert("x")</script>'
  const mail = buildOrderEmail(order, MAIL)
  assert.equal(mail.from, MAIL.from)
  assert.equal(mail.to, MAIL.to)
  assert.equal(mail.replyTo, "test@example.com")
  assert.equal(mail.subject, "Perfumira Website – New Order – PF-261022-AAAA")
  assert.ok(mail.html.includes("&lt;script&gt;"))
  assert.ok(mail.text.includes("14106~4") && mail.text.includes("Language: English"))
  const rendered = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(mail)
  assert.ok(rendered.message.toString().includes("multipart/alternative"))
})
test("an edited resubmit is emailed as an update of the same reference", async () => {
  const order = { ...(await verifyOrder({ ...input(), locale: "ar" }, user, getProduct, async () => new Map([[14106, "اسم معتمد"]]))), revision: 2 }
  const mail = buildOrderEmail(order, MAIL)
  assert.equal(mail.subject, "Perfumira Website – Updated Order – PF-261022-AAAA")
  assert.match(mail.text, /^UPDATED ORDER: .*PF-261022-AAAA \(version 2\)/)
  assert.ok(mail.text.includes("Language: Arabic") && mail.text.includes("Shown to the customer as: اسم معتمد (بالعلبه)"))
})

const CLAIM_TTL_MS = 5 * 60 * 1000
/** In-memory stand-in for store_verified_order / claim / finish (same rules as the SQL). */
function harness({ smtpFails = false, storageFails = false, expired = false, transport: useTransport = true, smtpError } = {}) {
  let row; let sends = 0; let now = 0
  const logs = []
  const store = {
    authenticate: async () => expired ? null : user,
    arabicNames: async () => new Map(),
    save: async (order, owner, fingerprint) => {
      if (storageFails) throw new Error("secret database failure")
      if (!row) row = { id: "order-id", verified_snapshot: { ...order, revision: 1 }, revision: 1, notification_status: "pending", fingerprint, owner }
      else if (row.fingerprint !== fingerprint) {
        const revision = row.revision + 1
        row = { ...row, verified_snapshot: { ...order, revision }, revision, fingerprint, notification_status: "pending", claim: null, claimedAt: null }
      }
      return structuredClone(row)
    },
    current: async () => (row ? structuredClone(row) : null),
    claimNotification: async () => {
      const stale = row.notification_status === "sending" && now - row.claimedAt >= CLAIM_TTL_MS
      if (!["pending", "failed"].includes(row.notification_status) && !stale) return null
      row.notification_status = "sending"; row.claim = `claim-${now}-${Math.random()}`; row.claimedAt = now
      return row.claim
    },
    finishNotification: async (_, claim, status) => {
      if (row.notification_status !== "sending" || row.claim !== claim) return false
      row.notification_status = status; row.claim = null; row.claimedAt = null; return true
    },
  }
  const mails = []
  const transport = useTransport ? { sendMail: async (mail) => { sends++; mails.push(mail); if (smtpFails) throw smtpError ?? Object.assign(new Error("SMTP secret"), { code: "EAUTH", responseCode: 535, command: "AUTH PLAIN" }); return {} } } : null
  const handler = createOrderHandler({ store, getProduct, transport, mail: MAIL, log: (message, detail) => logs.push({ message, detail }) })
  return { row: () => row, sends: () => sends, mails, logs, advance: (ms) => { now += ms }, setRow: (patch) => Object.assign(row, patch), run: async (body = input()) => {
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this }, json(body) { return { status: this.statusCode, body } } }
    return handler({ headers: { authorization: "Bearer test" }, body }, res)
  } }
}
test("storage before notification; repeat submission returns same order without second email", async () => {
  const h = harness()
  const first = await h.run(); const second = await h.run()
  assert.equal(first.body.ok, true); assert.equal(second.body.ok, true)
  assert.equal(h.sends(), 1); assert.equal(h.row().notification_status, "sent")
  assert.deepEqual(first.body.order, second.body.order)
  assert.equal(first.body.updated, false)
  assert.equal(h.mails[0].to, MAIL.to)
})
test("edited resubmit keeps the reference and notifies the company again as an update", async () => {
  const h = harness()
  await h.run()
  const edited = input(); edited.delivery.address = "New address 34"
  const result = await h.run(edited)
  assert.equal(result.body.ok, true); assert.equal(result.body.updated, true)
  assert.equal(result.body.order.reference, "PF-261022-AAAA"); assert.equal(result.body.order.revision, 2)
  assert.equal(h.sends(), 2)
  assert.equal(h.mails[1].subject, "Perfumira Website – Updated Order – PF-261022-AAAA")
})
test("SMTP failure after commit preserves success, durable retry status and safe SMTP fields in the log", async () => {
  const h = harness({ smtpFails: true }); const result = await h.run()
  assert.equal(result.body.ok, true); assert.equal(result.body.emailState, "error")
  assert.equal(h.row().notification_status, "failed")
  assert.ok(!JSON.stringify(result).includes("SMTP secret"))
  const entry = h.logs.find((l) => l.message === "Order notification failed")
  assert.deepEqual(entry.detail, { category: "smtp", reference: "PF-261022-AAAA", code: "EAUTH", responseCode: 535, command: "AUTH PLAIN" })
})
test("a failed notification is retried by the next submission of the same order", async () => {
  const h = harness({ smtpFails: true }); await h.run()
  assert.equal(h.row().notification_status, "failed")
  await h.run()
  assert.equal(h.sends(), 2)
})
test("a stale sending claim (crashed sender) is recovered; a fresh one is not", async () => {
  const h = harness(); await h.run()
  h.setRow({ notification_status: "sending", claim: "dead-sender", claimedAt: 0 })
  h.advance(60 * 1000)
  const fresh = await h.run()
  assert.equal(fresh.body.emailState, "sending"); assert.equal(h.sends(), 1)
  h.advance(CLAIM_TTL_MS)
  const recovered = await h.run()
  assert.equal(recovered.body.emailState, "success"); assert.equal(h.sends(), 2)
  assert.equal(h.row().notification_status, "sent")
})
test("no mail transport: the order is stored and the browser hears email is unavailable", async () => {
  const h = harness({ transport: false }); const result = await h.run()
  assert.equal(result.body.ok, true); assert.equal(result.body.emailState, "unavailable")
  assert.equal(h.row().notification_status, "pending")
})
test("storage failure never reports success or sends an email", async () => {
  const h = harness({ storageFails: true }); const result = await h.run()
  assert.equal(result.body.ok, false); assert.equal(h.sends(), 0)
  assert.equal(h.logs[0].detail.category, "unexpected")
  assert.ok(!JSON.stringify(h.logs).includes("secret database failure"))
})
test("expired sessions never create orders and are logged as authentication", async () => {
  const h = harness({ expired: true }); const result = await h.run()
  assert.equal(result.status, 401); assert.equal(h.row(), undefined)
  assert.deepEqual(h.logs[0].detail, { category: "authentication", code: "session_expired" })
})
test("concurrent duplicates only send one notification", async () => {
  const h = harness(); await Promise.all([h.run(), h.run()]); assert.equal(h.sends(), 1)
})
test("failure logs carry categories, never customer details", async () => {
  const cases = [
    [async () => ({ ...product, is_available: false }), "unavailable_product"],
    [async () => { throw Object.assign(new Error("x"), { name: "TypeError" }) }, "unexpected"],
    [async () => { const p = structuredClone(product); p.variations[0].options[0].price_after_discount = "530.00"; return p }, "price_changed"],
  ]
  for (const [lookup, category] of cases) {
    const logs = []
    const store = { authenticate: async () => user, save: async () => { throw new Error("unreached") } }
    const handler = createOrderHandler({ store, getProduct: lookup, mail: MAIL, log: (message, detail) => logs.push(detail) })
    await handler({ headers: { authorization: "Bearer t" }, body: input() }, { status() { return this }, json: (b) => b })
    assert.equal(logs[0].category, category)
    const text = JSON.stringify(logs)
    for (const secret of ["Test Buyer", "test@example.com", "Test address 12", "+201001234567"]) assert.ok(!text.includes(secret), `${category} log leaks ${secret}`)
  }
})
test("the order rate limit is configurable and answers rate_limited", async () => {
  const logs = []
  const app = createApp({ distDir: ".", transport: null, mail: MAIL, orderLimit: { windowMs: 60000, limit: 1 }, trustProxy: false, log: (message, detail) => logs.push({ message, detail }) })
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)) })
  try {
    const post = () => fetch(`http://127.0.0.1:${server.address().port}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
    assert.equal((await post()).status, 503)
    const limited = await post()
    assert.equal(limited.status, 429)
    assert.deepEqual(await limited.json(), { ok: false, error: "rate_limited" })
    assert.ok(logs.some((l) => l.detail?.category === "rate_limited"))
  } finally { await new Promise((resolve) => server.close(resolve)) }
})
test("there is no /api/broadcast endpoint on this server", async () => {
  const app = createApp({ distDir: ".", transport: null, mail: MAIL, trustProxy: false, log: () => {} })
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)) })
  try {
    for (const method of ["GET", "POST"]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/broadcast`, { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? "{}" : undefined })
      assert.equal(response.status, 404)
      assert.deepEqual(await response.json(), { ok: false, error: "not_found" })
    }
  } finally { await new Promise((resolve) => server.close(resolve)) }
})
test("the order currency is the storefront's documented catalogue currency", async () => {
  const fs = await import("node:fs")
  const catalog = fs.readFileSync(new URL("../src/config/catalog.ts", import.meta.url), "utf8")
  assert.match(catalog, new RegExp(`currency: "${ORDER_CURRENCY}"`))
})

// ORDER_MAIL_TO: order notifications go to their own inbox; contact mail stays on MAIL_TO.
async function postThroughApp(appOptions) {
  const sent = []
  const transport = { sendMail: async (message) => { sent.push(message); return {} } }
  const orderStore = {
    authenticate: async () => user,
    arabicNames: async () => new Map(),
    save: async (order) => ({ id: "order-1", revision: 1, notification_status: "pending", verified_snapshot: { ...order, revision: 1 } }),
    claimNotification: async () => "claim-1",
    finishNotification: async () => true,
  }
  const app = createApp({ distDir: ".", transport, orderStore, getProduct, trustProxy: false, log: () => {}, ...appOptions })
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)) })
  try {
    const base = `http://127.0.0.1:${server.address().port}/api`
    const order = await fetch(`${base}/orders`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer test" }, body: JSON.stringify(input()) })
    const contact = await fetch(`${base}/contact`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Contact Tester", email: "contact@example.com", phone: "+201001234567", subject: "Hello", message: "Hello there, a question.", locale: "en", nectar: "" }) })
    return { order: order.status, contact: contact.status, sent }
  } finally { server.close() }
}
test("orders email ORDER_MAIL_TO while contact mail stays on MAIL_TO", async () => {
  const contactMail = { from: MAIL.from, to: "info@example.test" }
  const result = await postThroughApp({ mail: contactMail, orderMail: { from: MAIL.from, to: "sales@example.test" } })
  assert.equal(result.order, 200)
  const orderMessage = result.sent.find((m) => /order/i.test(m.subject) && m.replyTo === "test@example.com" && m.to === "sales@example.test")
  assert.ok(orderMessage, "order notification sent to the order inbox")
  assert.ok(!result.sent.some((m) => m.to === "info@example.test" && m === orderMessage), "order not sent to MAIL_TO")
  assert.equal(result.contact, 200, "contact form accepted")
  const contactMessage = result.sent.find((m) => m.replyTo?.address === "contact@example.com")
  assert.equal(contactMessage?.to, "info@example.test", "contact still goes to MAIL_TO")
  assert.equal(result.sent.filter((m) => m.to === "sales@example.test").length, 1, "exactly one order notification")
})
test("without ORDER_MAIL_TO, orders fall back to MAIL_TO", async () => {
  const result = await postThroughApp({ mail: { from: MAIL.from, to: "info@example.test" } })
  assert.equal(result.order, 200)
  assert.equal(result.sent.length >= 1 && result.sent[0].to, "info@example.test")
})

// Minimum order (here a Welp value of EGP 1,000) on verified product subtotal (after sale prices, without shipping).
/** A plain product (no options) with a real sale: before price, sale price. */
const plain = (id, after, before = null) => ({ id, name: `Plain ${id}`, price_before_discount: before, price_after_discount: after, image: "https://example.test/p.png", is_available: true, variations: [] })
/** Shaped like live 14113: list price 599 on sale, one required main-price choice 900 / 1100. */
const optionProduct = { id: 14113, name: "Olympea", price_before_discount: "1100.00", price_after_discount: "599.00", is_offer: true, image: "https://example.test/o.png", is_available: true, is_variation_available: true,
  variations: [{ id: 4849, name: "إختار", is_required: true, is_main_price: true, is_select_multiple: false, max_selection: 1,
    options: [{ id: 12301, name: "بدون علبة", price_after_discount: "900.00", price_before_discount: null }, { id: 12300, name: "بالعلبه", price_after_discount: "1100.00", price_before_discount: null }] }] }
const catalogue = new Map([[1, plain(1, "599.00", "1200.00")], [2, plain(2, "401.00")], [3, plain(3, "999.00")], [4, plain(4, "1000.00")], [5, plain(5, "1001.00")], [6, plain(6, "999.99")], [14113, optionProduct]])
const lookup = async (productId) => structuredClone(catalogue.get(productId))
/** A browser request for these lines, quoting the browser's own prices. */
const cart = (lines) => ({ ...input(), lines: lines.map(([welpProductId, unitPrice, quantity = 1, options = []]) => ({ welpProductId, productId: String(welpProductId), name: "x", options, unitPrice, quantity })),
  displayedTotal: lines.reduce((sum, [, price, quantity = 1]) => sum + price * quantity, 0) })
const withoutBox = [{ variationId: 4849, optionId: 12301, label: "Without box" }]
const withBox = [{ variationId: 4849, optionId: 12300, label: "With box" }]
const below = (subtotal) => (e) => e.code === "minimum_order_not_met" && e.status === 422 && e.extra.minimum === 1000 && e.extra.subtotal === subtotal && e.extra.currency === "EGP"

test("the fixed shared/orderRules.json minimum is gone", async () => {
  const fs = await import("node:fs")
  assert.equal(fs.existsSync(new URL("../shared/orderRules.json", import.meta.url)), false)
  assert.equal("MINIMUM_ORDER_SUBTOTAL" in await import("./orders.mjs"), false)
})
for (const [name, lines, subtotal] of [
  ["EGP 599 sale price (before 1,200) is below the minimum", [[1, 599]], 599],
  ["EGP 999 is below the minimum", [[3, 999]], 999],
  ["EGP 999.99 is below the minimum (no rounding up)", [[6, 999.99]], 999.99],
  ["Without box EGP 900 uses the option price, not the 599 list price", [[14113, 900, 1, withoutBox]], 900],
]) test(name, async () => {
  await assert.rejects(verifyOrder(cart(lines), user, lookup), below(subtotal))
})
for (const [name, lines, subtotal] of [
  ["exactly EGP 1,000 is allowed", [[4, 1000]], 1000],
  ["EGP 1,001 is allowed", [[5, 1001]], 1001],
  ["two items 599 + 401 reach exactly EGP 1,000", [[1, 599], [2, 401]], 1000],
  ["quantity 2 of a EGP 599 sale item (1,198) is allowed", [[1, 599, 2]], 1198],
  ["With box EGP 1,100 is allowed", [[14113, 1100, 1, withBox]], 1100],
  ["Without box x 2 (EGP 1,800) is allowed", [[14113, 900, 2, withoutBox]], 1800],
]) test(name, async () => {
  const order = await verifyOrder(cart(lines), user, lookup)
  assert.equal(order.subtotal, subtotal)
})
test("the browser cannot lift a cart over the minimum with invented prices", async () => {
  // The browser claims 1,200 (the struck-through price); the catalogue charges 599.
  await assert.rejects(verifyOrder(cart([[1, 1200]]), user, lookup), below(599))
  await assert.rejects(verifyOrder(cart([[14113, 1100, 1, withoutBox]]), user, lookup), below(900))
})
test("a cart under the minimum is never stored or emailed and answers 422 minimum_order_not_met", async () => {
  const logs = []; let saves = 0; let sends = 0; let claims = 0
  const store = { authenticate: async () => user, arabicNames: async () => new Map(),
    save: async () => { saves++; throw new Error("must not store") }, claimNotification: async () => { claims++; return "c" }, finishNotification: async () => true }
  const transport = { sendMail: async () => { sends++; return {} } }
  const handler = createOrderHandler({ store, transport, mail: MAIL, getProduct: lookup, log: (message, detail) => logs.push({ message, detail }) })
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this }, json(body) { return { status: this.statusCode, body } } }
  const result = await handler({ headers: { authorization: "Bearer test" }, body: cart([[1, 599]]) }, res)
  assert.equal(result.status, 422)
  assert.deepEqual(result.body, { ok: false, error: "minimum_order_not_met", minimum: 1000, subtotal: 599, productSubtotal: 599, discount: 0, currency: "EGP" })
  assert.equal(saves, 0); assert.equal(claims, 0); assert.equal(sends, 0)
  assert.deepEqual(logs[0].detail, { category: "minimum_order", code: "minimum_order_not_met", subtotal: 599 })
})
test("POST /api/orders under the minimum: 422, nothing stored, no email; at the minimum: stored and emailed", async () => {
  const sent = []; const saved = []
  const transport = { sendMail: async (message) => { sent.push(message); return {} } }
  const orderStore = { authenticate: async () => user, arabicNames: async () => new Map(),
    save: async (order) => { saved.push(order); return { id: "order-1", revision: 1, notification_status: "pending", verified_snapshot: { ...order, revision: 1 } } },
    claimNotification: async () => "claim-1", finishNotification: async () => true }
  const app = createApp({ distDir: ".", transport, orderStore, getProduct: lookup, mail: MAIL, trustProxy: false, log: () => {} })
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)) })
  try {
    const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer test" }, body: JSON.stringify(body) })
    const rejected = await post(cart([[3, 999]]))
    assert.equal(rejected.status, 422)
    assert.deepEqual(await rejected.json(), { ok: false, error: "minimum_order_not_met", minimum: 1000, subtotal: 999, productSubtotal: 999, discount: 0, currency: "EGP" })
    assert.equal(saved.length, 0); assert.equal(sent.length, 0)
    const accepted = await post(cart([[1, 599], [2, 401]]))
    assert.equal(accepted.status, 200)
    const body = await accepted.json()
    assert.equal(body.ok, true); assert.equal(body.order.subtotal, 1000)
    assert.equal(saved.length, 1); assert.equal(sent.length, 1)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})

// Buy 3, Get the 4th Free (shared/buy4Promotion.mjs), on verified prices only.
catalogue.set(7, plain(7, "710.00")); catalogue.set(8, plain(8, "750.00")); catalogue.set(10, plain(10, "710.00"))
catalogue.set(11, plain(11, "900.00")); catalogue.set(12, plain(12, "300.00"))
/** Like cart(), but quoting a chosen displayed total (what the browser showed). */
const promoCart = (lines, displayedTotal, extra = {}) => ({ ...cart(lines), displayedTotal, ...extra })
// 1 is a sale item (before 1,200). 710 + 599 + 750 + 900 = 2,959; cheapest (599) free = 2,360.
const owner = [[7, 710], [1, 599], [8, 750], [11, 900]]
// The old Buy 3 example: 3 units, which no longer qualify.
const three = [[7, 710], [1, 599], [8, 750]]
const freeOf = (order) => Object.fromEntries(order.lines.filter((l) => l.freeQuantity).map((l) => [l.productId, l.freeQuantity]))
test("buy 4: cheapest verified unit free; unit prices unchanged; promotion stored explicitly", async () => {
  const order = await verifyOrder(promoCart(owner, 2360), user, lookup)
  assert.equal(order.subtotal, 2959)
  assert.equal(order.displayedTotal, 2360)
  assert.deepEqual(order.promotion, { id: "buy4-cheapest-free", name: "Buy 3, Get the 4th Free", freeUnits: 1, discount: 599, payableSubtotal: 2360 })
  assert.deepEqual(freeOf(order), { 1: 1 })
  const sale = order.lines.find((l) => l.productId === "1")
  assert.equal(sale.unitPrice, 599); assert.equal(sale.lineTotal, 599); assert.equal(sale.promotionDiscount, 599)
  assert.equal(order.lines.filter((l) => l.freeQuantity === undefined).length, 3)
})
for (const [name, lines, subtotal] of [
  ["1 unit", [[4, 1000]], 1000],
  ["2 units", [[7, 710], [1, 599]], 1309],
  ["3 different units (the old Buy 3 trigger)", three, 2059],
  ["3 of the same unit", [[7, 710, 3]], 2130],
  ["A x2 + B x1", [[8, 750, 2], [7, 710, 1]], 2210],
]) test(`buy 4: ${name} -> no promotion, full price`, async () => {
  const order = await verifyOrder(promoCart(lines, subtotal), user, lookup)
  assert.equal(order.promotion, null); assert.equal(order.subtotal, subtotal); assert.equal(order.displayedTotal, subtotal); assert.deepEqual(freeOf(order), {})
})
for (const [name, lines, subtotal, discount, free] of [
  ["4 of the same unit: one free", [[7, 710, 4]], 2840, 710, { 7: 1 }],
  ["5 units: one free", [[7, 710, 2], [8, 750, 3]], 3670, 710, { 7: 1 }],
  ["7 units: still one free", [[7, 710, 3], [8, 750, 4]], 5130, 710, { 7: 1 }],
  ["8 units of two products: two cheapest free (quantities count)", [[1, 599, 5], [7, 710, 3]], 5125, 1198, { 1: 2 }],
  ["8 units over four lines: the two cheapest lines' units", [[11, 900, 3], [8, 750, 3], [7, 710], [1, 599]], 6259, 1309, { 1: 1, 7: 1 }],
  ["12 units over two lines: three free", [[7, 710, 6], [8, 750, 6]], 8760, 2130, { 7: 3 }],
  ["mixed quantities: A x3 + B x1", [[8, 750, 3], [7, 710, 1]], 2960, 710, { 7: 1 }],
  ["option prices: Without box 900 is cheapest among options", [[14113, 900, 3, withoutBox], [14113, 1100, 1, withBox]], 3800, 900, { "14113~12301": 1 }],
  ["option + sale item: the 599 sale unit is free, not an option", [[14113, 900, 1, withoutBox], [14113, 1100, 1, withBox], [1, 599], [8, 750]], 3349, 599, { 1: 1 }],
]) test(`buy 4: ${name}`, async () => {
  const order = await verifyOrder(promoCart(lines, subtotal - discount), user, lookup)
  assert.equal(order.subtotal, subtotal); assert.equal(order.promotion.discount, discount); assert.equal(order.displayedTotal, subtotal - discount)
  assert.equal(order.promotion.freeUnits, Object.values(free).reduce((a, b) => a + b, 0))
  assert.deepEqual(freeOf(order), free)
})
test("buy 4: same-price tie is decided by line id, whatever the bag order", async () => {
  const a = await verifyOrder(promoCart([[7, 710], [10, 710], [8, 750], [11, 900]], 2360), user, lookup)
  const b = await verifyOrder(promoCart([[11, 900], [8, 750], [10, 710], [7, 710]], 2360), user, lookup)
  assert.deepEqual(freeOf(a), { 10: 1 }); assert.deepEqual(freeOf(b), freeOf(a))
})
for (const [name, request] of [
  ["claims the wrong free product (the 750 one)", () => promoCart(owner, 2209, { promotion: { freeUnits: 1, discount: 750 } })],
  ["claims a larger discount", () => promoCart(owner, 0, { promotion: { freeUnits: 3, discount: 2959, payableSubtotal: 0 } })],
  ["changes a unit price", () => { const r = promoCart(owner, 2360); r.lines[1].unitPrice = 1; return r }],
  ["sends no promotion at all (pre-promotion total)", () => promoCart(owner, 2959)],
]) test(`buy 4 tampering: ${name} -> the server computes its own promotion`, async () => {
  let quote
  await assert.rejects(verifyOrder(request(), user, lookup), (e) => { quote = e.extra.order; return e.code === "price_changed" })
  assert.equal(quote.displayedTotal, 2360); assert.equal(quote.promotion.discount, 599); assert.deepEqual(freeOf(quote), { 1: 1 })
  const confirmed = await verifyOrder(quote, user, lookup)
  assert.equal(confirmed.displayedTotal, 2360); assert.deepEqual(freeOf(confirmed), { 1: 1 })
})
test("buy 4 tampering: a stale browser applying the old Buy 3 rule to 3 units is refused and quoted at full price", async () => {
  // What the previous release showed for these 3 units: 2,059 - 599 = 1,460.
  const stale = promoCart(three, 1460, { promotion: { id: "buy3-cheapest-free", name: "Buy 3 — Cheapest Item Free", freeUnits: 1, discount: 599, payableSubtotal: 1460 } })
  stale.lines[1].freeQuantity = 1; stale.lines[1].promotionDiscount = 599
  let quote
  await assert.rejects(verifyOrder(stale, user, lookup), (e) => { quote = e.extra.order; return e.code === "price_changed" })
  assert.equal(quote.displayedTotal, 2059); assert.equal(quote.promotion, null); assert.deepEqual(freeOf(quote), {})
  // Same for 3 of one product (old rule: 1 free).
  await assert.rejects(verifyOrder(promoCart([[7, 710, 3]], 1420), user, lookup), (e) => e.code === "price_changed" && e.extra.order.displayedTotal === 2130)
})
test("buy 4 tampering: browser promotion fields are ignored even with the right total", async () => {
  const request = promoCart(owner, 2360, { promotion: { id: "x", freeUnits: 9, discount: 9999 } })
  request.lines[2].freeQuantity = 1; request.lines[2].promotionDiscount = 750
  const order = await verifyOrder(request, user, lookup)
  assert.deepEqual(freeOf(order), { 1: 1 }); assert.equal(order.promotion.discount, 599)
})
test("buy 4 + minimum: checked after the promotion (4 x 300 = 1,200 - 300 = 900 is refused)", async () => {
  await assert.rejects(verifyOrder(promoCart([[12, 300, 4]], 900), user, lookup),
    (e) => e.code === "minimum_order_not_met" && e.extra.subtotal === 900 && e.extra.productSubtotal === 1200 && e.extra.discount === 300)
  // A browser claiming the pre-promotion total cannot get past it either.
  await assert.rejects(verifyOrder(promoCart([[12, 300, 4]], 1200), user, lookup), (e) => e.code === "minimum_order_not_met")
  // 3 x 401 = 1,203: no promotion any more (the old rule made it 802 and refused it).
  assert.equal((await verifyOrder(promoCart([[2, 401, 3]], 1203), user, lookup)).displayedTotal, 1203)
  // 599 + 401 + 300 x 2 = 1,600, minus 300 = 1,300: allowed.
  assert.equal((await verifyOrder(promoCart([[1, 599], [2, 401], [12, 300, 2]], 1300), user, lookup)).displayedTotal, 1300)
  // 4 x 599 = 2,396, minus 599 = 1,797: allowed.
  assert.equal((await verifyOrder(promoCart([[1, 599, 4]], 1797), user, lookup)).displayedTotal, 1797)
})
test("buy 4: POST /api/orders below the minimum after the promotion stores and emails nothing", async () => {
  const sent = []; const saved = []
  const orderStore = { authenticate: async () => user, arabicNames: async () => new Map(),
    save: async (order) => { saved.push(order); return { id: "o", revision: 1, notification_status: "pending", verified_snapshot: { ...order, revision: 1 } } },
    claimNotification: async () => "c", finishNotification: async () => true }
  const app = createApp({ distDir: ".", transport: { sendMail: async (m) => { sent.push(m); return {} } }, orderStore, getProduct: lookup, mail: MAIL, trustProxy: false, log: () => {} })
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)) })
  try {
    const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer test" }, body: JSON.stringify(body) })
    const rejected = await post(promoCart([[12, 300, 4]], 900))
    assert.equal(rejected.status, 422)
    assert.deepEqual(await rejected.json(), { ok: false, error: "minimum_order_not_met", minimum: 1000, subtotal: 900, productSubtotal: 1200, discount: 300, currency: "EGP" })
    assert.equal(saved.length, 0); assert.equal(sent.length, 0)
    const accepted = await (await post(promoCart(owner, 2360))).json()
    assert.equal(accepted.ok, true); assert.equal(accepted.order.displayedTotal, 2360)
    assert.equal(saved.length, 1); assert.equal(saved[0].subtotal, 2959); assert.equal(saved[0].promotion.discount, 599)
    assert.equal(saved[0].promotion.id, "buy4-cheapest-free")
    assert.equal(saved[0].lines.find((l) => l.productId === "1").unitPrice, 599)
    const text = sent[0].text
    assert.match(text, /^1 \| Plain 1 \| 1 x 599 EGP = 599 EGP$/m)
    assert.match(text, /Buy 3, Get the 4th Free: 1 of 1 free \(discount -599 EGP; catalogue price unchanged\)/)
    assert.match(text, /Products subtotal \(verified prices, before promotion\): 2959 EGP/)
    assert.match(text, /Buy 3, Get the 4th Free \(1 free unit, cheapest\): -599 EGP/)
    assert.match(text, /Payable product subtotal \/ displayed total: 2360 EGP/)
    assert.doesNotMatch(text, /599 EGP = 0|x 0 EGP|Cheapest Item Free/)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})
test("buy 4: an order without the promotion keeps the old email wording", async () => {
  const mail = buildOrderEmail(await verifyOrder(promoCart(three, 2059), user, lookup), MAIL)
  assert.match(mail.text, /Subtotal \/ displayed total: 2059 EGP/)
  assert.doesNotMatch(mail.text, /Buy 3|4th Free/)
})

// Tax is always zero (owner decision, 2026-11-13): recorded as 0, never added.
test("tax: always 0, stored as 0, and the total is the post-promotion subtotal + nothing", async () => {
  assert.equal(ORDER_TAX, 0)
  for (const [lines, payable] of [[owner, 2360], [three, 2059], [[[7, 710], [1, 599]], 1309], [[[1, 599, 4]], 1797]]) {
    const order = await verifyOrder(promoCart(lines, payable), user, lookup)
    assert.equal(order.tax, 0)
    assert.equal(order.shipping, null)
    assert.equal(order.displayedTotal, payable)
    assert.equal(order.displayedTotal, order.subtotal - (order.promotion?.discount ?? 0))
  }
  // A browser total with any tax added is refused and quoted back without it.
  let quote
  await assert.rejects(verifyOrder(promoCart(owner, 2360 * 1.14), user, lookup), (e) => { quote = e.extra.order; return e.code === "price_changed" })
  assert.equal(quote.displayedTotal, 2360); assert.equal(quote.tax, 0)
  // Whatever tax the browser sends is never read.
  assert.equal((await verifyOrder(promoCart(owner, 2360, { tax: 330 }), user, lookup)).tax, 0)
})
test("tax: the order email states Tax: 0 EGP and no longer says tax is to be confirmed", async () => {
  for (const [lines, payable] of [[owner, 2360], [[[7, 710], [1, 599]], 1309]]) {
    const text = buildOrderEmail(await verifyOrder(promoCart(lines, payable), user, lookup), MAIL).text
    assert.match(text, /^Tax: 0 EGP$/m)
    assert.match(text, /^Shipping: to be confirmed by store; no payment collected\.$/m)
    assert.doesNotMatch(text, /Shipping and tax/i)
  }
})

// Legacy tax representation: orders stored before 2026-11-14 carry tax: null (or no
// tax field) and a fingerprint made by the old orderFingerprint (plain JSON of the
// snapshot without createdAt). Resubmitting the same order must match that fingerprint.
const legacyFingerprint = (snapshot) => { const { createdAt, ...stable } = snapshot; return createHash("sha256").update(JSON.stringify(stable)).digest("hex") }
const withTax = (order, tax) => { const out = {}; for (const [k, v] of Object.entries(order)) if (k !== "tax") { out[k] = v; if (k === "shipping" && tax !== undefined) out.tax = tax } return out }
test("fingerprint: legacy tax: null snapshot = new tax: 0 order (same order)", async () => {
  const order = await verifyOrder(input(), user, getProduct)
  assert.equal(order.tax, 0)
  const legacy = withTax(order, null)
  assert.equal(orderFingerprint(order), legacyFingerprint(legacy), "matches the fingerprint stored by the old code")
  assert.equal(orderFingerprint(order), orderFingerprint(legacy))
})
test("fingerprint: legacy snapshot without a tax field = new tax: 0 order (same order)", async () => {
  const order = await verifyOrder(input(), user, getProduct)
  const missing = withTax(order, undefined)
  assert.ok(!("tax" in missing))
  assert.equal(orderFingerprint(missing), orderFingerprint(order))
  assert.equal(orderFingerprint(missing), legacyFingerprint(withTax(order, null)))
})
test("fingerprint: tax: 0 vs tax: 0 is the same order; createdAt is ignored", async () => {
  const a = await verifyOrder(input(), user, getProduct)
  const b = { ...(await verifyOrder(input(), user, getProduct)), createdAt: "2030-01-01T00:00:00.000Z" }
  assert.equal(orderFingerprint(a), orderFingerprint(b))
})
test("fingerprint: real content changes are still a different order", async () => {
  const base = await verifyOrder(input(), user, getProduct)
  const legacy = legacyFingerprint(withTax(base, null))
  const changes = {
    quantity: (r) => { r.lines[0].quantity = 3; r.displayedTotal = 1561.5 /* 3 units: no promotion (Buy 3, Get the 4th Free needs 4) */ },
    option: (r) => { r.lines[0].options[0].optionId = 5; r.lines[0].unitPrice = 500; r.displayedTotal = 1000 },
    address: (r) => { r.delivery.address = "Another address 7" },
    notes: (r) => { r.notes = "Ring twice" },
    gift: (r) => { r.gift = { message: "For you" } },
  }
  for (const [name, change] of Object.entries(changes)) {
    const request = input(); change(request)
    const changed = await verifyOrder(request, user, getProduct)
    assert.notEqual(orderFingerprint(changed), orderFingerprint(base), name)
    assert.notEqual(orderFingerprint(changed), legacy, `${name} (vs legacy)`)
  }
  // Price and promotion changes (verified on the server).
  const repriced = await verifyOrder({ ...input(), lines: [{ ...input().lines[0], options: [], unitPrice: 530 }], displayedTotal: 1060 }, user, async () => ({ ...product, variations: [], price_after_discount: 530 }))
  assert.notEqual(orderFingerprint(repriced), orderFingerprint(base), "price")
  const plainThree = await verifyOrder(promoCart(three, 2059), user, lookup)
  const four = await verifyOrder(promoCart(owner, 2360), user, lookup)
  assert.notEqual(orderFingerprint(four), orderFingerprint(plainThree), "promotion total")
  // A non-zero tax would be a real change, never folded into the legacy form.
  assert.notEqual(orderFingerprint({ ...base, tax: 5 }), orderFingerprint(base), "non-zero tax")
})
test("resubmit after release: a legacy tax: null order is returned as is, no version 2, no Updated Order email", async () => {
  const h = harness()
  const order = await verifyOrder(input(), user, getProduct)
  // The row as the previous release stored and emailed it.
  const legacy = { ...withTax(order, null), revision: 1 }
  await h.run(); h.setRow({ verified_snapshot: legacy, fingerprint: legacyFingerprint(withTax(order, null)), revision: 1, notification_status: "sent" })
  const sendsBefore = h.sends()
  const again = await h.run()
  assert.equal(again.body.ok, true); assert.equal(again.body.updated, false)
  assert.equal(h.row().revision, 1); assert.equal(h.sends(), sendsBefore)
  assert.equal(h.row().verified_snapshot.tax, null, "historical row left untouched")
  assert.ok(!h.mails.some((m) => /Updated Order/.test(m.subject)))
  // Same for a legacy row with no tax field.
  h.setRow({ verified_snapshot: { ...withTax(order, undefined), revision: 1 }, fingerprint: legacyFingerprint(withTax(order, null)) })
  await h.run(); assert.equal(h.row().revision, 1); assert.equal(h.sends(), sendsBefore)
  // A genuine edit still becomes version 2 with an Updated Order email.
  const edited = input(); edited.lines[0].quantity = 3; edited.displayedTotal = 1561.5
  const result = await h.run(edited)
  assert.equal(result.body.ok, true); assert.equal(result.body.updated, true)
  assert.equal(h.row().revision, 2); assert.equal(h.sends(), sendsBefore + 1)
  assert.match(h.mails.at(-1).subject, /Updated Order/)
})

// Perfume Boxes (Welp type 1684) are shown as perfume sets; the company name stays the record.
const box = { id: 14126, product_type: 1684, name: "Louis Vuitton Gift Set", price_after_discount: "599.00", image: "https://example.test/box.jpg", is_available: true, variations: [] }
const boxInput = (locale = "en") => ({ ...input(), locale, displayedTotal: 1198,
  lines: [{ welpProductId: 14126, productId: "spoof", name: "Invented", options: [], unitPrice: 599, quantity: 2 }] })
test("perfume sets: company name kept as the record; displayName and nameAr say Perfume Set", async () => {
  const order = await verifyOrder(boxInput(), user, async () => structuredClone(box))
  assert.equal(order.lines[0].name, "Louis Vuitton Gift Set")
  assert.equal(order.lines[0].displayName, "Louis Vuitton Perfume Set")
  assert.equal(order.lines[0].nameAr, "Louis Vuitton Perfume Set")
  const mail = buildOrderEmail({ ...order, revision: 1 }, MAIL)
  assert.ok(mail.text.includes("14126 | Louis Vuitton Perfume Set | 2 x 599 EGP"))
  assert.ok(mail.text.includes("\n   Catalogue name: Louis Vuitton Gift Set"))
  assert.ok(mail.text.indexOf("Perfume Set") < mail.text.indexOf("Gift Set"), "the storefront name leads")
  assert.equal(mail.text.includes("Shown to the customer as:"), false)
  // Arabic page without an approved Arabic name: same lines, nothing extra.
  const arMail = buildOrderEmail({ ...(await verifyOrder(boxInput("ar"), user, async () => structuredClone(box))), revision: 1 }, MAIL)
  assert.ok(arMail.text.includes("14126 | Louis Vuitton Perfume Set |") && arMail.text.includes("Catalogue name: Louis Vuitton Gift Set"))
  assert.equal(arMail.text.includes("Shown to the customer as:"), false)
})
test("perfume sets email: an approved Arabic name is still noted under the Perfume Set name", async () => {
  const order = await verifyOrder(boxInput("ar"), user, async () => structuredClone(box), async () => new Map([[14126, "اسم معتمد"]]))
  const mail = buildOrderEmail({ ...order, revision: 1 }, MAIL)
  assert.ok(mail.text.includes("14126 | Louis Vuitton Perfume Set |"))
  assert.ok(mail.text.includes("Catalogue name: Louis Vuitton Gift Set") && mail.text.includes("Shown to the customer as: اسم معتمد"))
})
test("non-set lines keep the old email format (no Catalogue name line)", async () => {
  const mail = buildOrderEmail({ ...(await verifyOrder(input(), user, getProduct)), revision: 1 }, MAIL)
  assert.equal(mail.text.includes("Catalogue name:"), false)
})
test("perfume sets: an approved Arabic name still wins on Arabic pages", async () => {
  const order = await verifyOrder(boxInput("ar"), user, async () => structuredClone(box), async () => new Map([[14126, "اسم معتمد"]]))
  assert.equal(order.lines[0].nameAr, "اسم معتمد")
  assert.equal(order.lines[0].displayName, "Louis Vuitton Perfume Set")
})
test("perfume sets: an unavailable set is named as the storefront names it", async () => {
  await assert.rejects(verifyOrder(boxInput(), user, async () => ({ ...box, is_available: false })),
    (error) => error.code === "unavailable_product" && error.extra.name === "Louis Vuitton Perfume Set" && error.extra.nameAr === "Louis Vuitton Perfume Set")
})
test("other types are never renamed and get no displayName (their fingerprint is unchanged)", async () => {
  const chanel = { ...box, id: 13160, product_type: 1344, name: "BLEU DE CHANEL GIFT SET" }
  const order = await verifyOrder({ ...boxInput(), lines: [{ ...boxInput().lines[0], welpProductId: 13160 }] }, user, async () => structuredClone(chanel))
  assert.equal(order.lines[0].name, "BLEU DE CHANEL GIFT SET")
  assert.equal("displayName" in order.lines[0], false)
  assert.equal(order.lines[0].nameAr, "BLEU DE CHANEL GIFT SET")
  const plain = await verifyOrder(input(), user, getProduct)
  assert.equal("displayName" in plain.lines[0], false)
})

// Editing a stored order: Save Changes (no email), Save & Send (email with
// the server's own list of changes), and no email when nothing effective changed.
const edited = (patch = {}) => { const body = input(); return { ...body, ...patch, customer: { ...body.customer, ...(patch.customer ?? {}) }, delivery: { ...body.delivery, ...(patch.delivery ?? {}) } } }
test("edit: Save Changes stores the new version without emailing the team", async () => {
  const h = harness()
  assert.equal((await h.run()).body.emailState, "success")
  assert.equal(h.sends(), 1)
  const r = await h.run(edited({ customer: { phone: "+201112223334" }, notify: false }))
  assert.equal(r.body.emailState, "saved")
  assert.equal(h.sends(), 1, "no email")
  assert.equal(h.row().revision, 2)
  assert.equal(h.row().notification_status, "pending")
  assert.equal(h.row().verified_snapshot.lastSent.customer.phone, "+201001234567", "the version the team has is kept")
  assert.equal("lastSent" in r.body.order, false, "never sent to the browser")
})
test("edit: Send after Save emails the changes since the version the team has", async () => {
  const h = harness()
  await h.run()
  await h.run(edited({ customer: { phone: "+201112223334" }, notify: false }))
  const r = await h.run(edited({ customer: { phone: "+201112223334" }, notify: true }))
  assert.equal(r.body.emailState, "success")
  assert.equal(r.body.changeCount, 1)
  assert.equal(h.sends(), 2)
  const text = h.mails.at(-1).text
  assert.match(text, /^UPDATED ORDER: the customer edited and resubmitted order PF-261022-AAAA \(version 2\)/)
  assert.match(text, /ORDER CHANGES \(compared with version 1, the last version emailed to the team\):\n- Phone: "\+201001234567" → "\+201112223334"\n\nCURRENT ORDER \(complete, after the changes\):/)
  assert.match(text, /Phone \/ customer WhatsApp: \+201112223334/)
  // Sending the same version again: nothing new, no second email.
  assert.equal((await h.run(edited({ customer: { phone: "+201112223334" } }))).body.emailState, "success")
  assert.equal(h.sends(), 2)
})
test("edit: Save & Send in one step lists quantity and total changes", async () => {
  const h = harness()
  await h.run()
  const body = input(); body.lines[0].quantity = 3; body.displayedTotal = 1561.5; body.notes = "Leave with the doorman"
  const r = await h.run(body)
  assert.equal(r.body.emailState, "success")
  const text = h.mails.at(-1).text
  assert.match(text, /- Order note: \(empty\) → "Leave with the doorman"/)
  assert.match(text, /- Quantity, Real catalogue name \(With box\): 2 → 3/)
  assert.match(text, /- Total: 1041 EGP → 1561.5 EGP/)
  assert.match(text, /CURRENT ORDER[\s\S]*14106~4 \| Real catalogue name/)
})
test("edit: a spacing-only change or a change reverted before sending emails nothing", async () => {
  const h = harness()
  await h.run()
  // Different text, same effective value: a new version, no email.
  const spaced = await h.run(edited({ customer: { fullName: "Test  Buyer" } }))
  assert.equal(spaced.body.emailState, "unchanged")
  assert.equal(h.sends(), 1)
  assert.equal(h.row().notification_status, "sent")
  // Saved (not sent) then changed back: the team already has this version.
  await h.run(edited({ delivery: { cityArea: "Other city" }, notify: false }))
  const back = await h.run(edited({ customer: { fullName: "Test  Buyer" }, notify: true }))
  assert.equal(back.body.emailState, "unchanged")
  assert.equal(h.sends(), 1)
})
test("edit: browser-claimed changes and versions are ignored", async () => {
  const h = harness()
  await h.run()
  const forged = edited({ customer: { email: "new@example.com" }, lastSent: { customer: { phone: "999" } }, changes: [{ kind: "field", label: "Phone", from: "1", to: "999" }], changeCount: 9 })
  const r = await h.run(forged)
  assert.equal(r.body.changeCount, 1)
  const text = h.mails.at(-1).text
  assert.doesNotMatch(text, /999/)
  assert.match(text, /- Email: "test@example.com" → "new@example.com"/)
  assert.equal(h.row().verified_snapshot.lastSent.customer.email, "test@example.com", "the stored baseline comes from the server's record")
})
test("edit: notify false on a first request is ignored (a new order is always sent)", async () => {
  const h = harness()
  const r = await h.run({ ...input(), notify: false })
  assert.equal(r.body.emailState, "success")
  assert.equal(h.sends(), 1)
  assert.doesNotMatch(h.mails[0].text, /UPDATED ORDER|ORDER CHANGES/)
})

// 2026-11-20: an order's phone must be a complete Egyptian mobile and its email
// complete (shared/contactRules.mjs); the server refuses them on its own.
for (const [field, value] of [["phone", "0101234567"], ["phone", "010123456789"], ["phone", "0101234567a"], ["phone", "+44 7700 900123"],
  ["email", "test@example"], ["email", "test@@example.com"], ["email", "test@example..com"]])
  test(`refuses ${field} "${value}" as invalid_contact`, async () => {
    const request = input(); request.customer[field] = value
    await assert.rejects(verifyOrder(request, user, getProduct), (e) => e.code === "invalid_contact" && e.status === 400 && e.extra.field === field)
  })
test("accepts 01 / +20 / Arabic-digit mobiles; stores ASCII digits", async () => {
  for (const phone of ["01001234567", "+20 100 123 4567", "٠١٠٠١٢٣٤٥٦٧"]) {
    const request = input(); request.customer.phone = phone
    const order = await verifyOrder(request, user, getProduct)
    assert.match(order.customer.phone, /^[+\d ]+$/)
  }
})
test("GET /api/orders/:reference: owner only, latest version, no lastSent", async () => {
  const rows = new Map([[`${user.id}:PF-261022-AAAA`, { revision: 2, notification_status: "pending", verified_snapshot: { reference: "PF-261022-AAAA", revision: 2, lastSent: { x: 1 } } }]])
  const store = {
    authenticate: async (token) => (token === "s.owner-session" ? user : token === "other" ? { id: "22222222-2222-2222-2222-222222222222" } : null),
    current: async (owner, reference) => rows.get(`${owner}:${reference}`) ?? null,
  }
  const handler = createOrderLookupHandler({ store })
  const call = async (authorization, reference) => {
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this }, json(body) { return { status: this.statusCode, body } } }
    return handler({ headers: authorization ? { authorization } : {}, params: { reference } }, res)
  }
  // A real Supabase token contains letters such as "s" (a regex slip refused those once).
  assert.deepEqual(await call("Bearer s.owner-session", "PF-261022-AAAA"), { status: 200, body: { ok: true, order: { reference: "PF-261022-AAAA", revision: 2 }, emailState: "saved" } })
  assert.deepEqual((await call("Bearer other", "PF-261022-AAAA")).body, { ok: false, error: "not_found" })
  assert.equal((await call("Bearer other", "PF-261022-AAAA")).status, 404)
  assert.equal((await call(undefined, "PF-261022-AAAA")).status, 401)
  assert.equal((await call("Bearer nobody", "PF-261022-AAAA")).status, 401)
  assert.equal((await call("Bearer s.owner-session", "../etc")).status, 404)
})
