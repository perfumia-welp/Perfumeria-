/*
 * Order rules from the company (Welp): today, the minimum order.
 *
 * The merchant sets the minimum in Welp, and the public business record
 * returns it as `data.products_settings.minimum_order_amount` (EGP; owner
 * decision, 2026-11-14). It is compared with the verified payable product
 * subtotal after the Buy 3 promotion, without shipping or tax
 * (server/orders.mjs). The site keeps no copy of the number: GET
 * /api/order-rules (what the bag and checkout show) and POST /api/orders
 * (what is enforced) read it through the same createOrderRules() instance,
 * so they agree for every value it has loaded.
 *
 * Cache: a value read successfully is reused for `ttlMs` (60 s), then read
 * again, so a change in Welp reaches the site within a minute without a
 * deployment. An expired value is never used: if Welp cannot be read and no
 * value younger than `ttlMs` exists, get() throws OrderRulesUnavailableError
 * and checkout fails closed. There is no fallback number. After a failed
 * read, callers within `failureCooldownMs` (5 s) get the same error without
 * a new upstream request, so an outage is not multiplied by visitor traffic.
 */

const BUSINESS_URL = "https://api.welpstar.com/api/v1/businesses/84116"
const FETCH_TIMEOUT_MS = 10000
/** Anything above this is treated as a broken value, not a minimum. */
const MAX_MINIMUM = 1000000

export const ORDER_RULES_TTL_MS = 60 * 1000
export const ORDER_RULES_FAILURE_COOLDOWN_MS = 5 * 1000

/** The minimum order could not be read from Welp (or was not valid). `detail` goes to the server log only. */
export class OrderRulesUnavailableError extends Error {
  constructor(detail = {}) {
    super("order_rules_unavailable")
    this.detail = detail
  }
}

/**
 * The minimum order from a business record's `data`, in EGP, or throws.
 * Valid: a finite number (or a plain decimal string, as some Welp amounts
 * are) from 0 up, with at most 2 decimals. 0 means no minimum.
 */
export function parseMinimumOrderAmount(record) {
  const raw = record?.products_settings?.minimum_order_amount
  const value = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+(?:\.\d{1,2})?$/.test(raw.trim()) ? Number(raw) : NaN
  if (!Number.isFinite(value) || value < 0 || value > MAX_MINIMUM || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6)
    throw new OrderRulesUnavailableError({ reason: raw === undefined ? "missing" : "invalid", type: raw === null ? "null" : typeof raw })
  return Math.round(value * 100) / 100
}

/** One read of the live business record (GET only, public, no token). */
export async function fetchMinimumOrderAmount() {
  let response
  try {
    response = await fetch(BUSINESS_URL, {
      headers: { "App-ID": "WEBSITE", "Accept-Language": "EN", Accept: "application/json" },
      redirect: "error", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    throw new OrderRulesUnavailableError({ reason: error?.name === "TimeoutError" ? "timeout" : "network" })
  }
  if (!response.ok) throw new OrderRulesUnavailableError({ upstreamStatus: response.status })
  let body
  try { body = await response.json() } catch { throw new OrderRulesUnavailableError({ reason: "body" }) }
  if (body?.data?.id !== 84116) throw new OrderRulesUnavailableError({ reason: "business" })
  return parseMinimumOrderAmount(body.data)
}

/**
 * @param {object} [options]
 * @param {() => Promise<number>} [options.fetchMinimum] Reads the minimum; defaults to Welp.
 * @param {number} [options.ttlMs]
 * @param {number} [options.failureCooldownMs]
 * @param {() => number} [options.now]
 * @returns {{ get(): Promise<{ minimumOrderSubtotal: number }> }}
 */
export function createOrderRules({
  fetchMinimum = fetchMinimumOrderAmount,
  ttlMs = ORDER_RULES_TTL_MS,
  failureCooldownMs = ORDER_RULES_FAILURE_COOLDOWN_MS,
  now = Date.now,
} = {}) {
  let cached = null // { minimum, at }
  let failure = null // { error, at }
  let pending = null
  const read = async () => {
    try {
      // Checked (and normalised to a number) here too, so any reader is held to the same rule.
      const minimum = parseMinimumOrderAmount({ products_settings: { minimum_order_amount: await fetchMinimum() } })
      cached = { minimum, at: now() }
      failure = null
      return minimum
    } catch (error) {
      const unavailable = error instanceof OrderRulesUnavailableError ? error : new OrderRulesUnavailableError({ reason: "unexpected", name: error?.name })
      failure = { error: unavailable, at: now() }
      throw unavailable
    } finally {
      pending = null
    }
  }
  return {
    async get() {
      if (cached && now() - cached.at < ttlMs) return { minimumOrderSubtotal: cached.minimum }
      if (failure && now() - failure.at < failureCooldownMs) throw failure.error
      pending ??= read()
      return { minimumOrderSubtotal: await pending }
    },
  }
}
