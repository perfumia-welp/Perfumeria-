import assert from "node:assert/strict"
import { test } from "node:test"
import { createApp } from "./app.mjs"
import {
  OPTION_PRICES_CACHE_CONTROL, OptionPricesUnavailableError,
  buildOptionPriceIndex, createOptionPriceIndex, optionFromPrice,
} from "./optionPrices.mjs"

// Option "From" prices for the catalogue's price filter and sort.
// Nothing here calls Welp: the catalogue, the details and the clock are fakes.

const boxChoice = (withBox, withoutBox, extra = {}) => ({
  id: 1, name: "اختر", is_required: true, is_main_price: true, is_select_multiple: false, max_selection: 1,
  options: [
    { id: 11, name: "بالعلبة", price_before_discount: null, price_after_discount: withBox },
    { id: 12, name: "بدون علبة", price_before_discount: null, price_after_discount: withoutBox },
  ],
  ...extra,
})
const row = (id, price, options = true) => ({ id, price_after_discount: price, is_variation_available: options })
/** A fake Welp: /all-products groups and /products/{id} details; counts every request. */
function fakeWelp({ groups, details, fail = new Set() }) {
  const calls = []
  const get = async (path) => {
    calls.push(path)
    if (path === "/all-products") return { data: groups }
    const id = Number(path.split("/").pop())
    if (fail.has(id)) throw new OptionPricesUnavailableError({ upstreamStatus: 502 })
    return { data: { id, variations: details[id] ?? [] } }
  }
  return { get, calls }
}

test("optionFromPrice: cheapest option of required main-price choices only", () => {
  assert.equal(optionFromPrice({ variations: [boxChoice("1100.00", "900.00")] }), 900)
  assert.equal(optionFromPrice({ variations: [boxChoice(699, 599)] }), 599)
  // Not required, or not a price choice: not the card's "From".
  assert.equal(optionFromPrice({ variations: [boxChoice(1100, 900, { is_required: false })] }), undefined)
  assert.equal(optionFromPrice({ variations: [boxChoice(1100, 900, { is_main_price: false })] }), undefined)
  // Missing / malformed option prices are skipped, never read as 0.
  assert.equal(optionFromPrice({ variations: [boxChoice(1100, null)] }), 1100)
  assert.equal(optionFromPrice({ variations: [boxChoice("abc", "-5")] }), undefined)
  assert.equal(optionFromPrice({}), undefined)
  assert.equal(optionFromPrice(null), undefined)
})

test("build: one catalogue read, details for option products only, only differing prices returned", async () => {
  const welp = fakeWelp({
    groups: [
      { name: "Men", products: [row(1, "1100.00"), row(2, "900.00"), row(3, "500.00", false)] },
      // Same product in a second group (Offers): read once.
      { name: "Offers", products: [row(1, "1100.00"), row(4, "699.00")] },
    ],
    details: { 1: [boxChoice("1100.00", "900.00")], 2: [boxChoice("1100.00", "900.00")], 4: [boxChoice(699, 599)] },
  })
  const result = await buildOptionPriceIndex({ get: welp.get })
  assert.deepEqual(result.prices, { 1: { list: 1100, from: 900 }, 4: { list: 699, from: 599 } })
  assert.equal(result.optionProducts, 3)
  assert.equal(result.failed, 0)
  assert.deepEqual(welp.calls.sort(), ["/all-products", "/products/1", "/products/2", "/products/4"])
})

test("build: a failed detail keeps its previous entry only while the list price is unchanged", async () => {
  const groups = [{ products: [row(1, 1100), row(2, 1000), row(3, 1100)] }]
  const details = { 3: [boxChoice(1100, 900)] }
  const previous = { 1: { list: 1100, from: 900 }, 2: { list: 1100, from: 900 } }
  const result = await buildOptionPriceIndex({ get: fakeWelp({ groups, details, fail: new Set([1, 2]) }).get, previous })
  // 1 kept (list still 1100); 2 dropped (list changed to 1000); 3 read fresh.
  assert.deepEqual(result.prices, { 1: { list: 1100, from: 900 }, 3: { list: 1100, from: 900 } })
  assert.equal(result.failed, 2)
  // Every detail failing is an outage, not an empty index.
  await assert.rejects(buildOptionPriceIndex({ get: fakeWelp({ groups, details, fail: new Set([1, 2, 3]) }).get }), OptionPricesUnavailableError)
  await assert.rejects(buildOptionPriceIndex({ get: async () => ({ nope: 1 }) }), OptionPricesUnavailableError)
})

test("build: never more than `concurrency` detail requests at once", async () => {
  let open = 0, peak = 0
  const groups = [{ products: Array.from({ length: 20 }, (_, i) => row(i + 1, 1000)) }]
  const get = async (path) => {
    if (path === "/all-products") return { data: groups }
    open++; peak = Math.max(peak, open)
    await new Promise((resolve) => setTimeout(resolve, 2))
    open--
    return { data: { id: Number(path.split("/").pop()), variations: [boxChoice(1000, 800)] } }
  }
  const result = await buildOptionPriceIndex({ get, concurrency: 4 })
  assert.equal(Object.keys(result.prices).length, 20)
  assert.equal(peak, 4)
})

test("cache: fresh reused, stale served at once while one rebuild runs, failures cooled down", async () => {
  let clock = 0, builds = 0, down = false, release
  const build = async () => {
    builds++
    if (down) throw new OptionPricesUnavailableError({ upstreamStatus: 503 })
    if (builds === 2) await new Promise((resolve) => { release = resolve })
    return { prices: { 1: { list: 1100, from: 900 - builds } }, optionProducts: 1, failed: 0 }
  }
  const index = createOptionPriceIndex({ build, freshMs: 100, maxStaleMs: 1000, failureCooldownMs: 50, now: () => clock })
  // Cold: callers share one build.
  const [a, b] = await Promise.all([index.get(), index.get()])
  assert.equal(builds, 1)
  assert.equal(a.prices[1].from, 899)
  assert.equal(b.prices[1].from, 899)
  clock = 99
  assert.equal((await index.get()).prices[1].from, 899)
  assert.equal(builds, 1, "fresh: no rebuild")
  // Stale: answered at once from the old index, one background rebuild.
  clock = 200
  assert.equal((await index.get()).prices[1].from, 899)
  assert.equal((await index.get()).prices[1].from, 899)
  assert.equal(builds, 2, "one rebuild for many stale reads")
  release()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal((await index.get()).prices[1].from, 898)
  // A failed background rebuild keeps serving the last index until maxStale.
  down = true
  clock = 400
  assert.equal((await index.get()).prices[1].from, 898)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(builds, 3)
  clock = 420
  await index.get()
  assert.equal(builds, 3, "cooldown after a failure: no new build")
  // Too old to serve: the caller gets the error, and the cooldown holds.
  clock = 200 + 1000 + 10
  await assert.rejects(index.get(), OptionPricesUnavailableError)
  assert.equal(builds, 4)
  await assert.rejects(index.get(), OptionPricesUnavailableError)
  assert.equal(builds, 4, "cooldown: the outage is not multiplied by traffic")
  down = false
  clock += 60
  assert.equal((await index.get()).prices[1].from, 895)
  assert.equal(builds, 5)
})

test("warm() starts one background build; get() then waits for that same build", async () => {
  let builds = 0
  const index = createOptionPriceIndex({ build: async () => { builds++; return { prices: {}, optionProducts: 0, failed: 0 } } })
  index.warm()
  index.warm()
  await index.get()
  assert.equal(builds, 1)
})

test("GET /api/catalog/option-prices: body, cache header, 503 fallback, orders untouched", async () => {
  let down = false
  const optionPrices = { get: async () => { if (down) throw new OptionPricesUnavailableError({}); return { prices: { 13143: { list: 1100, from: 900 } }, at: Date.UTC(2026, 10, 19) } } }
  const app = createApp({ distDir: ".", transport: null, mail: { from: "a@example.test", to: "b@example.test" }, optionPrices, trustProxy: false, log: () => {} })
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)) })
  const url = `http://127.0.0.1:${server.address().port}/api/catalog/option-prices`
  try {
    let response = await fetch(url)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), OPTION_PRICES_CACHE_CONTROL)
    assert.deepEqual(await response.json(), { currency: "EGP", generatedAt: "2026-11-19T00:00:00.000Z", prices: { 13143: { list: 1100, from: 900 } } })
    down = true
    response = await fetch(url)
    assert.equal(response.status, 503)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.deepEqual(await response.json(), { ok: false, error: "option_prices_unavailable" })
    assert.equal((await fetch(url, { method: "POST" })).status, 404)
  } finally {
    server.close()
  }
})
