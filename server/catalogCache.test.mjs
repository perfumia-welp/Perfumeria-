import test from "node:test"
import assert from "node:assert/strict"
import { createApp } from "./app.mjs"
import { CatalogUnavailableError, createCatalogCache, validCatalogBody } from "./catalogCache.mjs"

const body = (name = "Offers") => JSON.stringify({ codes: [], data: [{ name, products: [{ id: 1 }] }] })

function setup(reads) {
  let clock = 0
  let calls = 0
  const cache = createCatalogCache({
    now: () => clock,
    fetchCatalog: async () => {
      const next = reads[Math.min(calls++, reads.length - 1)]
      if (next instanceof Error) throw next
      return next
    },
  })
  return { cache, tick: (ms) => (clock += ms), calls: () => calls }
}

test("catalogue copy: only Welp-shaped bodies count", () => {
  assert.equal(validCatalogBody(JSON.parse(body())), true)
  for (const bad of [null, {}, { data: [] }, { data: [{ name: "x" }] }, { data: [{ products: [] }] }])
    assert.equal(validCatalogBody(bad), false)
})

test("catalogue copy: fresh served as is; stale served at once and refreshed once in the background", async () => {
  const { cache, tick, calls } = setup([body("A"), body("B")])
  assert.match((await cache.get()).json, /"A"/)
  tick(30_000)
  assert.match((await cache.get()).json, /"A"/)
  assert.equal(calls(), 1, "fresh: no new read")
  tick(60_000)
  const [one, two] = await Promise.all([cache.get(), cache.get()])
  assert.match(one.json, /"A"/, "stale copy answered without waiting")
  assert.match(two.json, /"A"/)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(calls(), 2, "one background refresh for both requests")
  assert.match((await cache.get()).json, /"B"/)
})

test("catalogue copy: failures keep the last good copy up to 10 minutes, never older; bad shapes refused", async () => {
  const fail = new CatalogUnavailableError({ upstreamStatus: 502 })
  const { cache, tick } = setup([body("A"), fail])
  await cache.get()
  tick(5 * 60_000)
  assert.match((await cache.get()).json, /"A"/, "stale copy served while the refresh fails")
  await new Promise((resolve) => setImmediate(resolve))
  tick(4 * 60_000)
  assert.match((await cache.get()).json, /"A"/, "still within 10 minutes")
  await new Promise((resolve) => setImmediate(resolve))
  tick(2 * 60_000) // 11 minutes old
  await assert.rejects(cache.get(), CatalogUnavailableError, "never served past 10 minutes")
  const broken = createCatalogCache({ fetchCatalog: async () => JSON.stringify({ data: [] }) })
  await assert.rejects(broken.get(), CatalogUnavailableError, "wrong shape is a failure")
})

test("GET /api/catalog/all-products: Welp JSON unchanged with its age; 503 when no copy", async (t) => {
  const json = body("Offers")
  for (const [catalog, status] of [
    [{ get: async () => ({ json, age: 42_000 }) }, 200],
    [{ get: async () => { throw new CatalogUnavailableError({ reason: "network" }) } }, 503],
  ]) {
    const app = createApp({ distDir: "dist-missing", catalog, log: () => {} })
    const server = app.listen(0)
    t.after(() => server.close())
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/catalog/all-products`)
    assert.equal(response.status, status)
    if (status === 200) {
      assert.equal(await response.text(), json)
      assert.equal(response.headers.get("x-catalog-age"), "42")
      assert.match(response.headers.get("content-type"), /application\/json/)
    } else assert.equal((await response.json()).error, "catalog_unavailable")
  }
})
