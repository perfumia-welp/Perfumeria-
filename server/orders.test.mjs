import assert from "node:assert/strict"
import { test } from "node:test"
import nodemailer from "nodemailer"
import { createApp } from "./app.mjs"
import { verifyOrder, createOrderHandler, buildOrderEmail, englishOptionLabel, ORDER_CURRENCY } from "./orders.mjs"

const MAIL = { from: "Perfumira Test <from@example.test>", to: "orders@example.test" }
const user = { id: "11111111-1111-1111-1111-111111111111" }
// Shaped like the live catalogue: English product name, Arabic option labels, no currency field.
const product = { id: 14106, name: "Real catalogue name", price_after_discount: "100.00", image: "https://example.test/bottle.png", is_available: true,
  variations: [{ id: 3, name: "اختار", is_required: true, is_main_price: true, options: [{ id: 4, name: "بالعلبه", price_after_discount: "120.50" }, { id: 5, name: "بدون علبة", price_after_discount: "100.00" }] }] }
const input = () => ({ reference: "PF-261022-AAAA", locale: "en", customer: { fullName: "Test Buyer", phone: "+201001234567", email: "test@example.com", userId: "spoof" },
  delivery: { address: "Test address 12", cityArea: "Test city" }, currency: "EGP", displayedTotal: 241,
  lines: [{ welpProductId: 14106, productId: "spoof", name: "Invented", nameAr: "مزيف", options: [{ variationId: 3, optionId: 4, label: "Invented" }], unitPrice: 120.50, quantity: 2 }] })
const getProduct = async () => structuredClone(product)
test("authoritative names, prices, IDs, option labels, quantity and owner", async () => {
  const order = await verifyOrder(input(), user, getProduct)
  assert.equal(order.customer.userId, user.id)
  assert.equal(order.lines[0].name, "Real catalogue name (With box)")
  assert.equal(order.lines[0].nameAr, "Real catalogue name (بالعلبه)")
  assert.deepEqual(order.lines[0].options, [{ variationId: 3, optionId: 4, label: "With box", labelAr: "بالعلبه" }])
  assert.equal(order.lines[0].productId, "14106~4")
  assert.equal(order.subtotal, 241)
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
  const changed = async () => ({ ...product, variations: [], price_after_discount: 130 })
  const request = input(); request.lines[0].options = []
  let quote
  await assert.rejects(verifyOrder(request, user, changed), (e) => { quote = e.extra.order; return e.code === "price_changed" })
  assert.equal(quote.displayedTotal, 260)
  assert.equal((await verifyOrder(quote, user, changed)).subtotal, 260)
})
test("stock change blocks acceptance and names the product in both languages", async () => {
  await assert.rejects(verifyOrder(input(), user, async () => ({ ...product, is_available: false }), async () => new Map([[14106, "اسم معتمد"]])),
    (e) => e.code === "unavailable_product" && e.status === 409 && e.extra.name === "Real catalogue name" && e.extra.nameAr === "اسم معتمد")
})
test("guest receives same verified snapshot without claiming an account owner", async () => {
  assert.equal((await verifyOrder(input(), { ...user, is_anonymous: true }, getProduct)).customer.userId, null)
})
test("plain products need no option; missing option detail fails closed", async () => {
  const request = input(); request.lines[0].options = []; request.lines[0].unitPrice = 100; request.displayedTotal = 200
  assert.equal((await verifyOrder(request, user, async () => ({ ...product, variations: [] }))).subtotal, 200)
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
    [async () => { const p = structuredClone(product); p.variations[0].options[0].price_after_discount = "130.00"; return p }, "price_changed"],
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
