import assert from "node:assert/strict"
import { test } from "node:test"
import { createApp } from "./app.mjs"
import { createOrderHandler, verifyOrder } from "./orders.mjs"
import {
  ORDER_RULES_FAILURE_COOLDOWN_MS, ORDER_RULES_TTL_MS, OrderRulesUnavailableError,
  createOrderRules, fetchMinimumOrderAmount, parseMinimumOrderAmount,
} from "./orderRules.mjs"

// The merchant's minimum order, read from Welp (products_settings.minimum_order_amount).
// Nothing here calls Welp: the business record and the clock are fakes.

const MAIL = { from: "Perfumira Test <from@example.test>", to: "orders@example.test" }
const user = { id: "11111111-1111-1111-1111-111111111111" }
const plain = (id, price) => ({ id, name: `Plain ${id}`, price_before_discount: null, price_after_discount: price, image: "https://example.test/p.png", is_available: true, variations: [] })
const PRICES = { 1: "597.00", 2: "598.00", 3: "999.00", 4: "1000.00", 5: "1499.00", 6: "1500.00", 7: "599.00", 8: "600.00", 9: "601.00", 10: "5000.00", 11: "1499.99" }
const lookup = async (id) => plain(id, PRICES[id])
const cart = (lines, displayedTotal) => ({
  reference: "PF-261114-RULES", locale: "en", currency: "EGP",
  customer: { fullName: "Test Buyer", phone: "+201001234567", email: "test@example.com" },
  delivery: { address: "Test address 12", cityArea: "Test city" },
  lines: lines.map(([welpProductId, quantity = 1]) => ({ welpProductId, productId: String(welpProductId), name: "x", options: [], unitPrice: Number(PRICES[welpProductId]), quantity })),
  displayedTotal: displayedTotal ?? lines.reduce((sum, [id, quantity = 1]) => sum + Number(PRICES[id]) * quantity, 0),
})
/** A rules source that reads `minimum()` on every call, like Welp after the cache expires. */
const welp = (minimum) => createOrderRules({ fetchMinimum: async () => minimum(), ttlMs: 0, failureCooldownMs: 0 })
const notMet = (minimum, subtotal) => (e) => e.code === "minimum_order_not_met" && e.status === 422 && e.extra.minimum === minimum && e.extra.subtotal === subtotal && e.extra.currency === "EGP"
const unavailable = (e) => e.code === "order_rules_unavailable" && e.status === 503

test("the Welp field: valid amounts, and every invalid or missing value refused", () => {
  const record = (value) => ({ products_settings: { minimum_order_amount: value } })
  for (const [value, expected] of [[598, 598], [0, 0], [1000, 1000], [1500, 1500], [598.5, 598.5], ["598", 598], ["1250.00", 1250]])
    assert.equal(parseMinimumOrderAmount(record(value)), expected, `valid ${JSON.stringify(value)}`)
  for (const value of [undefined, null, -1, NaN, Infinity, "abc", "", "-5", "1e3", 1.234, true, {}, [], 2000000]) {
    assert.throws(() => parseMinimumOrderAmount(record(value)), OrderRulesUnavailableError, `invalid ${JSON.stringify(value)}`)
  }
  assert.throws(() => parseMinimumOrderAmount({}), OrderRulesUnavailableError)
  assert.throws(() => parseMinimumOrderAmount(null), OrderRulesUnavailableError)
})

test("fetchMinimumOrderAmount reads data.products_settings.minimum_order_amount of business 84116 (GET, App-ID)", async (t) => {
  const calls = []
  let reply = () => new Response(JSON.stringify({ codes: [], data: { id: 84116, products_settings: { minimum_order_amount: 598 } } }), { status: 200 })
  t.mock.method(globalThis, "fetch", async (url, init) => { calls.push({ url, init }); return reply() })
  assert.equal(await fetchMinimumOrderAmount(), 598)
  assert.equal(calls[0].url, "https://api.welpstar.com/api/v1/businesses/84116")
  assert.equal(calls[0].init.method ?? "GET", "GET")
  assert.equal(calls[0].init.headers["App-ID"], "WEBSITE")
  for (const [label, make] of [
    ["HTTP 500", () => new Response("{}", { status: 500 })],
    ["not JSON", () => new Response("<html>", { status: 200 })],
    ["another business", () => new Response(JSON.stringify({ data: { id: 1, products_settings: { minimum_order_amount: 5 } } }), { status: 200 })],
    ["field missing", () => new Response(JSON.stringify({ data: { id: 84116, products_settings: {} } }), { status: 200 })],
    ["field null", () => new Response(JSON.stringify({ data: { id: 84116, products_settings: { minimum_order_amount: null } } }), { status: 200 })],
    ["network error", () => { throw new TypeError("fetch failed") }],
  ]) {
    reply = make
    await assert.rejects(fetchMinimumOrderAmount(), OrderRulesUnavailableError, label)
  }
})

test("cache: one Welp read per 60 s; a change in Welp shows after expiry (598 -> 1000 -> 1500)", async () => {
  assert.equal(ORDER_RULES_TTL_MS, 60000)
  let clock = 0, reads = 0, value = 598
  const rules = createOrderRules({ fetchMinimum: async () => { reads++; return value }, now: () => clock })
  assert.deepEqual(await rules.get(), { minimumOrderSubtotal: 598 })
  value = 1000; clock += 59999
  assert.deepEqual(await rules.get(), { minimumOrderSubtotal: 598 }, "still within 60 s")
  assert.equal(reads, 1)
  clock += 1
  assert.deepEqual(await rules.get(), { minimumOrderSubtotal: 1000 }, "read again at 60 s")
  value = 1500; clock += 60000
  assert.deepEqual(await rules.get(), { minimumOrderSubtotal: 1500 })
  assert.equal(reads, 3)
})

test("cache: concurrent requests share one Welp read", async () => {
  let reads = 0, release
  const rules = createOrderRules({ fetchMinimum: () => { reads++; return new Promise((resolve) => { release = () => resolve(598) }) } })
  const all = Promise.all([rules.get(), rules.get(), rules.get()])
  release()
  assert.deepEqual((await all).map((r) => r.minimumOrderSubtotal), [598, 598, 598])
  assert.equal(reads, 1)
})

test("failure: a value under 60 s old is used while Welp is down; an expired one never is", async () => {
  let clock = 0, down = false, reads = 0
  const rules = createOrderRules({ fetchMinimum: async () => { reads++; if (down) throw new OrderRulesUnavailableError({ reason: "network" }); return 598 }, now: () => clock })
  assert.equal((await rules.get()).minimumOrderSubtotal, 598)
  down = true; clock += 30000
  assert.equal((await rules.get()).minimumOrderSubtotal, 598, "valid cache within its lifetime")
  assert.equal(reads, 1, "no read while the cache is valid")
  clock += 30000
  await assert.rejects(rules.get(), OrderRulesUnavailableError, "expired + Welp down: fail closed, no stale value")
})

test("failure: no value ever read -> unavailable; retried after the 5 s cooldown, then recovers", async () => {
  assert.equal(ORDER_RULES_FAILURE_COOLDOWN_MS, 5000)
  let clock = 0, down = true, reads = 0
  const rules = createOrderRules({ fetchMinimum: async () => { reads++; if (down) throw new Error("socket hang up"); return 1250 }, now: () => clock })
  await assert.rejects(rules.get(), (e) => e instanceof OrderRulesUnavailableError && e.message === "order_rules_unavailable")
  clock += 4999
  await assert.rejects(rules.get(), OrderRulesUnavailableError)
  assert.equal(reads, 1, "no new upstream read within the cooldown")
  down = false; clock += 1
  assert.equal((await rules.get()).minimumOrderSubtotal, 1250)
  assert.equal(reads, 2)
})

test("an invalid value from the reader is refused, not used; a decimal string is normalised", async () => {
  for (const bad of [null, undefined, -1, NaN, "abc", 1.234]) {
    const rules = createOrderRules({ fetchMinimum: async () => bad, failureCooldownMs: 0 })
    await assert.rejects(rules.get(), OrderRulesUnavailableError, String(bad))
  }
  assert.deepEqual(await createOrderRules({ fetchMinimum: async () => "598.00" }).get(), { minimumOrderSubtotal: 598 })
})

for (const [minimum, below, at] of [[598, 1, 2], [1000, 3, 4], [1500, 5, 6]]) {
  test(`Welp minimum ${minimum}: EGP ${PRICES[below]} blocked, EGP ${PRICES[at]} allowed`, async () => {
    const rules = welp(() => minimum)
    await assert.rejects(verifyOrder(cart([[below]]), user, lookup, undefined, () => rules.get()), notMet(minimum, minimum - 1))
    const order = await verifyOrder(cart([[at]]), user, lookup, undefined, () => rules.get())
    assert.equal(order.displayedTotal, minimum)
  })
}

test("a cent under the minimum is blocked (1,499.99 < 1,500)", async () => {
  await assert.rejects(verifyOrder(cart([[11]]), user, lookup, undefined, welp(() => 1500).get), notMet(1500, 1499.99))
})

test("the same order follows the Welp value as it changes (no deployment)", async () => {
  let value = 598
  const rules = welp(() => value)
  const order = () => verifyOrder(cart([[4]]), user, lookup, undefined, () => rules.get())
  assert.equal((await order()).displayedTotal, 1000)
  value = 1000
  assert.equal((await order()).displayedTotal, 1000)
  value = 1500
  await assert.rejects(order(), notMet(1500, 1000))
})

test("Buy 3: the minimum is compared after the promotion, not before", async () => {
  // 599 + 600 + 601 = 1,800 before; cheapest (599) free -> 1,201 payable.
  const lines = [[7], [8], [9]]
  const at = (minimum) => verifyOrder(cart(lines, 1201), user, lookup, undefined, welp(() => minimum).get)
  await assert.rejects(at(1500), (e) => notMet(1500, 1201)(e) && e.extra.productSubtotal === 1800 && e.extra.discount === 599, "1,800 before >= 1,500, but 1,201 payable < 1,500")
  await assert.rejects(at(1202), notMet(1202, 1201))
  const order = await at(1201)
  assert.equal(order.displayedTotal, 1201)
  assert.equal(order.subtotal, 1800)
  assert.equal(order.promotion.discount, 599)
})

test("shipping and tax are not part of the comparison", async () => {
  const order = await verifyOrder(cart([[2]]), user, lookup, undefined, welp(() => 598).get)
  assert.equal(order.displayedTotal, 598)
  assert.equal(order.shipping, null)
  assert.equal(order.tax, 0)
  await assert.rejects(verifyOrder(cart([[1]]), user, lookup, undefined, welp(() => 598).get), (e) => notMet(598, 597)(e) && !("shipping" in e.extra) && !("tax" in e.extra))
})

test("rules unavailable: the order is refused with 503 order_rules_unavailable, never judged against 1,000", async () => {
  const down = createOrderRules({ fetchMinimum: async () => { throw new Error("down") }, failureCooldownMs: 0 })
  // 5,000 would pass any plausible minimum, 1,000 would pass a 1,000 fallback: both refused.
  for (const id of [10, 4, 3]) await assert.rejects(verifyOrder(cart([[id]]), user, lookup, undefined, () => down.get()), unavailable)
  // No rules source at all: refused too.
  await assert.rejects(verifyOrder(cart([[10]]), user, lookup), unavailable)
  await assert.rejects(verifyOrder(cart([[10]]), user, lookup, undefined, async () => ({ minimumOrderSubtotal: undefined })), unavailable)
})

test("the browser cannot send or lower the minimum", async () => {
  const body = { ...cart([[3]]), minimum: 0, minimumOrderSubtotal: 0, rules: { minimumOrderSubtotal: 0 } }
  await assert.rejects(verifyOrder(body, user, lookup, undefined, welp(() => 1000).get), notMet(1000, 999))
})

test("handler: rules unavailable -> 503, nothing stored or emailed, log without customer details", async () => {
  const logs = []; let saves = 0; let sends = 0
  const store = { authenticate: async () => user, arabicNames: async () => new Map(), save: async () => { saves++; throw new Error("must not store") },
    claimNotification: async () => "c", finishNotification: async () => true }
  const handler = createOrderHandler({ store, transport: { sendMail: async () => { sends++ } }, mail: MAIL, getProduct: lookup,
    getRules: async () => { throw new OrderRulesUnavailableError({ upstreamStatus: 502 }) }, log: (message, detail) => logs.push(detail) })
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this }, json(body) { return { status: this.statusCode, body } } }
  const result = await handler({ headers: { authorization: "Bearer test" }, body: cart([[10]]) }, res)
  assert.equal(result.status, 503)
  assert.deepEqual(result.body, { ok: false, error: "order_rules_unavailable" })
  assert.equal(saves, 0); assert.equal(sends, 0)
  assert.deepEqual(logs[0], { category: "order_rules", code: "order_rules_unavailable", upstreamStatus: 502 })
})

test("GET /api/order-rules and POST /api/orders share one rules source and one cache", async () => {
  let value = 598, reads = 0, down = false, clock = 0
  const orderRules = createOrderRules({ fetchMinimum: async () => { reads++; if (down) throw new Error("down"); return value }, now: () => clock })
  const saved = [], sent = []
  const orderStore = { authenticate: async () => user, arabicNames: async () => new Map(),
    save: async (order) => { saved.push(order); return { id: "o", revision: 1, notification_status: "pending", verified_snapshot: { ...order, revision: 1 } } },
    claimNotification: async () => "c", finishNotification: async () => true }
  const app = createApp({ distDir: ".", transport: { sendMail: async (m) => { sent.push(m); return {} } }, orderStore, getProduct: lookup, orderRules,
    mail: MAIL, trustProxy: false, log: () => {} })
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)) })
  const base = `http://127.0.0.1:${server.address().port}/api`
  const rulesNow = () => fetch(`${base}/order-rules`)
  const post = (body) => fetch(`${base}/orders`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer test" }, body: JSON.stringify(body) })
  try {
    let response = await rulesNow()
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.deepEqual(await response.json(), { minimumOrderSubtotal: 598, currency: "EGP" })
    // Same cached value enforced: 597 refused, 598 stored.
    let order = await post(cart([[1]]))
    assert.equal(order.status, 422)
    assert.deepEqual(await order.json(), { ok: false, error: "minimum_order_not_met", minimum: 598, subtotal: 597, productSubtotal: 597, discount: 0, currency: "EGP" })
    assert.equal((await post(cart([[2]]))).status, 200)
    assert.equal(reads, 1, "storefront and server used the same read")
    // The merchant changes it in Welp: both sides switch after the cache expires.
    value = 1500; clock += ORDER_RULES_TTL_MS
    assert.deepEqual(await (await rulesNow()).json(), { minimumOrderSubtotal: 1500, currency: "EGP" })
    order = await post(cart([[4]]))
    assert.equal(order.status, 422)
    assert.equal((await order.json()).minimum, 1500)
    // Welp down after expiry: both refuse, no fallback.
    down = true; clock += ORDER_RULES_TTL_MS
    response = await rulesNow()
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { ok: false, error: "order_rules_unavailable" })
    const before = saved.length
    order = await post(cart([[10]]))
    assert.equal(order.status, 503)
    assert.deepEqual(await order.json(), { ok: false, error: "order_rules_unavailable" })
    assert.equal(saved.length, before)
    assert.equal(sent.length, before)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})
