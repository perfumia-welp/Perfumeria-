/*
 * The company catalogue (Welp /all-products), kept by our server so the
 * site gets it in a fraction of a second.
 *
 * Why: Welp builds /all-products for ~2.8 s before sending its first byte
 * (measured 2026-11-24; the newest-20 page takes ~0.7 s). The site's default
 * order (Sale -> regular -> Perfume Sets) needs the whole catalogue, so every
 * cold visit to Products and the homepage Offers waited for that.
 *
 * What: GET /api/catalog/all-products answers with Welp's own JSON,
 * unchanged (the browser parses it exactly as it parses Welp's answer). Data
 * is never edited, filtered or reordered here.
 *
 * Freshness:
 *   - an answer younger than `freshMs` (60 s) is served as it is;
 *   - an older one (up to `maxStaleMs`, 10 min) is served at once while a new
 *     read starts in the background (stale-while-revalidate);
 *   - nothing older is ever served: the request waits for a new read;
 *   - `warm()` reads at start-up and then every `refreshMs` (2 min), so the
 *     copy is normally under 2 minutes old even with no visitors;
 *   - a failed read keeps the last good copy (within maxStaleMs) and is not
 *     retried for `failureCooldownMs`; with no usable copy the endpoint
 *     answers 503 and the browser reads Welp directly, as before.
 * Prices on an order are always re-read from Welp by POST /api/orders, so a
 * copy up to a few minutes old never changes what a customer pays.
 */
import { BUSINESS_URL } from "./orderRules.mjs"

export const ALL_PRODUCTS_URL = `${BUSINESS_URL}/all-products`
const FETCH_TIMEOUT_MS = 20000
export const CATALOG_FRESH_MS = 60 * 1000
export const CATALOG_MAX_STALE_MS = 10 * 60 * 1000
export const CATALOG_REFRESH_MS = 2 * 60 * 1000
export const CATALOG_FAILURE_COOLDOWN_MS = 10 * 1000

export class CatalogUnavailableError extends Error {
  constructor(detail = {}) {
    super("catalog_unavailable")
    this.detail = detail
  }
}

/** Only a catalogue shaped like Welp's (groups of product lists, some products) is kept. */
export function validCatalogBody(body) {
  if (!Array.isArray(body?.data) || !body.data.length) return false
  let products = 0
  for (const group of body.data) {
    if (!Array.isArray(group?.products)) return false
    products += group.products.length
  }
  return products > 0
}

/** One read of Welp /all-products (GET only, public, no token). Returns the JSON text. */
export async function fetchAllProducts() {
  let response
  try {
    response = await fetch(ALL_PRODUCTS_URL, {
      headers: { "App-ID": "WEBSITE", "Accept-Language": "en", Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    throw new CatalogUnavailableError({ reason: error?.name === "TimeoutError" ? "timeout" : "network" })
  }
  if (!response.ok) throw new CatalogUnavailableError({ upstreamStatus: response.status })
  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new CatalogUnavailableError({ reason: "body" })
  }
  if (!validCatalogBody(body)) throw new CatalogUnavailableError({ reason: "shape" })
  return text
}

/**
 * @param {object} [options]
 * @param {() => Promise<string>} [options.fetchCatalog] Reads the JSON text; defaults to Welp.
 * @returns {{ get(): Promise<{ json: string, age: number }>, warm(): () => void }}
 */
export function createCatalogCache({
  fetchCatalog = fetchAllProducts,
  freshMs = CATALOG_FRESH_MS,
  maxStaleMs = CATALOG_MAX_STALE_MS,
  refreshMs = CATALOG_REFRESH_MS,
  failureCooldownMs = CATALOG_FAILURE_COOLDOWN_MS,
  now = Date.now,
  log = () => {},
} = {}) {
  let cached = null // { json, at }
  let failure = null // { error, at }
  let pending = null

  const read = () => {
    pending ??= (async () => {
      try {
        const json = await fetchCatalog()
        // A reader other than fetchAllProducts is held to the same shape rule.
        if (!validCatalogBody(JSON.parse(json))) throw new CatalogUnavailableError({ reason: "shape" })
        cached = { json, at: now() }
        failure = null
        return cached
      } catch (error) {
        const unavailable = error instanceof CatalogUnavailableError ? error : new CatalogUnavailableError({ reason: "unexpected", name: error?.name })
        failure = { error: unavailable, at: now() }
        log("Catalogue copy could not be refreshed", unavailable.detail)
        throw unavailable
      } finally {
        pending = null
      }
    })()
    return pending
  }
  const coolingDown = () => failure && now() - failure.at < failureCooldownMs

  return {
    async get() {
      const age = cached ? now() - cached.at : Infinity
      if (age < freshMs) return { json: cached.json, age }
      if (age < maxStaleMs) {
        if (!coolingDown()) read().catch(() => {})
        return { json: cached.json, age }
      }
      if (coolingDown()) throw failure.error
      const fresh = await read()
      return { json: fresh.json, age: now() - fresh.at }
    },
    /** Reads now and every `refreshMs`; returns a function that stops it. */
    warm() {
      read().catch(() => {})
      const timer = setInterval(() => read().catch(() => {}), refreshMs)
      timer.unref?.()
      return () => clearInterval(timer)
    },
  }
}
