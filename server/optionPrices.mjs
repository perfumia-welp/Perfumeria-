/*
 * Option "From" prices for the catalogue's price filter and price sort.
 *
 * A product whose price depends on a required main-price choice (with box /
 * without box) shows "From <cheapest option>" on its card. Welp's list
 * (/all-products) carries only the product's own price_after_discount, which
 * for a few products is the dearer option, and option prices exist only on
 * /products/{id}. So the browser would need one request per option product
 * to filter and sort by what the card shows.
 *
 * Instead this server reads them once and keeps them: GET
 * /api/catalog/option-prices returns only the products whose cheapest option
 * differs from their list price, as { list, from }. The browser applies
 * `from` only while its own list price still equals `list`, so a price
 * corrected in Welp takes over at once, whatever this cache holds.
 *
 * Display only: orders never read this (server/orders.mjs reads each
 * product's own detail and option prices from Welp when an order is placed).
 *
 * Cache (in memory, per server process):
 * - an index younger than `freshMs` (15 min) is returned as is;
 * - an older one, up to `maxStaleMs` (6 h), is still returned at once while
 *   one background rebuild runs (stale-while-revalidate);
 * - with nothing usable, the first caller waits for the one shared build;
 * - after a failed build, no new build starts for `failureCooldownMs`
 *   (60 s), so a Welp outage is not multiplied by visitor traffic.
 * A build reads /all-products and then only the option products' details,
 * `concurrency` (4) at a time. A detail that fails keeps its previous entry.
 */

const BUSINESS_ID = 84116
const API_BASE = `https://api.welpstar.com/api/v1/businesses/${BUSINESS_ID}`
const FETCH_TIMEOUT_MS = 20000

export const OPTION_PRICES_FRESH_MS = 15 * 60 * 1000
export const OPTION_PRICES_MAX_STALE_MS = 6 * 60 * 60 * 1000
export const OPTION_PRICES_FAILURE_COOLDOWN_MS = 60 * 1000
export const OPTION_PRICES_CONCURRENCY = 4

export class OptionPricesUnavailableError extends Error {
  constructor(detail = {}) {
    super("option_prices_unavailable")
    this.detail = detail
  }
}

/** A Welp amount (number or decimal string) as a number, or undefined. Same rule as the storefront adapter. */
function money(value) {
  if (value === null || value === undefined || value === "") return undefined
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined
}

/**
 * The card's "From" price for a product detail: the lowest
 * price_after_discount among the options of its required main-price
 * choices (the storefront's optionPriceRange). Undefined when it has none.
 */
export function optionFromPrice(detail) {
  let min = Infinity
  for (const variation of Array.isArray(detail?.variations) ? detail.variations : []) {
    if (variation?.is_required !== true || variation?.is_main_price !== true) continue
    for (const option of Array.isArray(variation.options) ? variation.options : []) {
      const price = money(option?.price_after_discount)
      if (price !== undefined) min = Math.min(min, price)
    }
  }
  return Number.isFinite(min) ? min : undefined
}

/** One public GET to Welp (no token), JSON body or throws. */
export async function welpGet(path) {
  let response
  try {
    response = await fetch(API_BASE + path, {
      headers: { "App-ID": "WEBSITE", "Accept-Language": "EN", Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    throw new OptionPricesUnavailableError({ path, reason: error?.name === "TimeoutError" ? "timeout" : "network" })
  }
  if (!response.ok) throw new OptionPricesUnavailableError({ path, upstreamStatus: response.status })
  try {
    return await response.json()
  } catch {
    throw new OptionPricesUnavailableError({ path, reason: "body" })
  }
}

/**
 * Reads the index from Welp.
 * @param {object} [options]
 * @param {(path: string) => Promise<any>} [options.get]
 * @param {Record<string, { list: number, from: number }>} [options.previous] Kept for details that fail.
 * @param {number} [options.concurrency]
 * @returns {Promise<{ prices: Record<string, { list: number, from: number }>, optionProducts: number, failed: number }>}
 */
export async function buildOptionPriceIndex({ get = welpGet, previous = {}, concurrency = OPTION_PRICES_CONCURRENCY } = {}) {
  const body = await get("/all-products")
  if (!Array.isArray(body?.data)) throw new OptionPricesUnavailableError({ reason: "catalogue" })
  // id -> list price, option products only, first copy (as the storefront).
  const listed = new Map()
  for (const group of body.data) {
    for (const row of Array.isArray(group?.products) ? group.products : []) {
      const id = row?.id
      if (!Number.isSafeInteger(id) || id <= 0 || listed.has(id) || row.is_variation_available !== true) continue
      const list = money(row.price_after_discount)
      if (list !== undefined) listed.set(id, list)
    }
  }
  const ids = [...listed.keys()]
  const prices = {}
  let failed = 0
  let next = 0
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++]
      const list = listed.get(id)
      try {
        const detail = (await get(`/products/${id}`))?.data
        if (detail?.id !== id) throw new Error("mismatch")
        const from = optionFromPrice(detail)
        if (from !== undefined && from !== list) prices[id] = { list, from }
      } catch {
        failed++
        // Keep what was known, but only while the list price is unchanged.
        if (previous[id]?.list === list) prices[id] = previous[id]
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker))
  if (ids.length && failed === ids.length) throw new OptionPricesUnavailableError({ reason: "details", failed })
  return { prices, optionProducts: ids.length, failed }
}

/**
 * @param {object} [options]
 * @param {(previous: Record<string, { list: number, from: number }>) => Promise<{ prices: Record<string, { list: number, from: number }>, optionProducts: number, failed: number }>} [options.build]
 * @param {number} [options.freshMs]
 * @param {number} [options.maxStaleMs]
 * @param {number} [options.failureCooldownMs]
 * @param {() => number} [options.now]
 * @param {(message: string, detail?: object) => void} [options.log]
 */
export function createOptionPriceIndex({
  build = (previous) => buildOptionPriceIndex({ previous }),
  freshMs = OPTION_PRICES_FRESH_MS,
  maxStaleMs = OPTION_PRICES_MAX_STALE_MS,
  failureCooldownMs = OPTION_PRICES_FAILURE_COOLDOWN_MS,
  now = Date.now,
  log = () => {},
} = {}) {
  let cached = null // { prices, at }
  let failure = null // { error, at }
  let pending = null

  const refresh = () => {
    pending ??= (async () => {
      try {
        const result = await build(cached?.prices ?? {})
        cached = { prices: result.prices, at: now() }
        failure = null
        if (result.failed) log("Option prices partly refreshed", { failed: result.failed, optionProducts: result.optionProducts })
        return cached
      } catch (error) {
        const unavailable = error instanceof OptionPricesUnavailableError ? error : new OptionPricesUnavailableError({ reason: "unexpected", name: error?.name })
        failure = { error: unavailable, at: now() }
        log("Option prices unavailable", unavailable.detail)
        throw unavailable
      } finally {
        pending = null
      }
    })()
    return pending
  }
  const coolingDown = () => failure && now() - failure.at < failureCooldownMs

  return {
    /** The index, at once when one is usable; never older than maxStaleMs. */
    async get() {
      const age = cached ? now() - cached.at : Infinity
      if (age < freshMs) return { prices: cached.prices, at: cached.at }
      if (age < maxStaleMs) {
        if (!coolingDown()) refresh().catch(() => {})
        return { prices: cached.prices, at: cached.at }
      }
      if (coolingDown()) throw failure.error
      const fresh = await refresh()
      return { prices: fresh.prices, at: fresh.at }
    },
    /** Starts a build in the background (server start), so the first visitor does not wait. */
    warm() {
      if (!cached && !coolingDown()) refresh().catch(() => {})
    },
  }
}

/** The response body for GET /api/catalog/option-prices. */
export const optionPricesBody = ({ prices, at }) => ({
  currency: "EGP",
  generatedAt: new Date(at).toISOString(),
  prices,
})

/** Browsers (and the host's CDN) may reuse an answer briefly; the server cache does the rest. */
export const OPTION_PRICES_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=600"
