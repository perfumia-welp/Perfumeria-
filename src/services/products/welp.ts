import { LIVE_CATALOG } from "../../config/catalog.ts"
import type { WelpProduct } from "./adapter.ts"

/*
 * Read-only client for the public company catalogue. Direct browser GETs:
 * the API is public (no token) and allows any origin (CORS *), so no proxy
 * is needed. Paths are fixed here; callers pass only a numeric product id.
 *
 * Strategy for ~371 products (measured 2026-10-16):
 * - /products?page=1 (20 newest, ~0.5 s) renders the site first;
 * - /all-products (~300 KB, ~3 s, server-bound) follows in the background
 *   for client-side search, filters, sorting and paging. Fetching all 19
 *   pages in parallel took as long, in 19 requests instead of one;
 * - /products/{id} only when a product page is opened (options, freshest
 *   price). Never once per product.
 */
const base = `${LIVE_CATALOG.apiBase}/businesses/${LIVE_CATALOG.businessId}`

/** Answers that may well succeed a moment later. */
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const RETRY_DELAY_MS = 800

class CatalogRequestError extends Error {
  readonly transient: boolean
  constructor(message: string, transient: boolean) {
    super(message)
    this.transient = transient
  }
}

async function attempt(path: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LIVE_CATALOG.timeoutMs)
  try {
    let response: Response
    try {
      response = await fetch(base + path, {
        method: "GET",
        headers: {
          "App-ID": LIVE_CATALOG.appId,
          // Company text is English whatever the page language (see adapter.ts).
          "Accept-Language": "EN",
          Accept: "application/json",
        },
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      })
    } catch {
      throw new CatalogRequestError("Catalogue request failed", !controller.signal.aborted)
    }
    if (!response.ok)
      throw new CatalogRequestError("Catalogue request failed", TRANSIENT_STATUS.has(response.status))
    try {
      return await response.json()
    } catch {
      // A body cut off mid-download (mobile networks) reads as invalid JSON.
      throw new CatalogRequestError("Invalid catalogue response", !controller.signal.aborted)
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * One more try, shortly after a dropped connection or a busy server: a phone
 * changing networks fails every request in flight at once. Never after a
 * timeout (that already waited) and never more than once.
 */
async function get(path: string): Promise<unknown> {
  try {
    return await attempt(path)
  } catch (error) {
    if (!(error instanceof CatalogRequestError) || !error.transient) throw error
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    return attempt(path)
  }
}

export interface WelpCatalog {
  products: WelpProduct[]
  /** Product type id → its company (English) group name. */
  categoryNames: Record<number, string>
}

/** A record as text with its keys sorted, so two copies compare by content only. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`
  return JSON.stringify(value) ?? "undefined"
}

/**
 * /all-products is grouped, and one product can sit in several groups (a
 * product type and a collection such as "Offers"). The catalogue holds each
 * product once, at its first position. Copies must be identical: two
 * different records under one id are still refused, never silently picked.
 */
export async function fetchWelpCatalog(): Promise<WelpCatalog> {
  const body = (await get("/all-products")) as {
    data?: { name?: unknown; products?: unknown }[]
  }
  if (!Array.isArray(body?.data)) throw new Error("Invalid catalogue")
  const products: WelpProduct[] = []
  const firstCopy = new Map<number, WelpProduct>()
  const categoryNames: Record<number, string> = {}
  for (const group of body.data) {
    if (!Array.isArray(group?.products)) throw new Error("Invalid catalogue")
    for (const product of group.products as WelpProduct[]) {
      const id = product?.id
      const earlier = Number.isSafeInteger(id) ? firstCopy.get(id) : undefined
      if (!earlier) {
        products.push(product)
        if (Number.isSafeInteger(id)) firstCopy.set(id, product)
      } else if (canonical(earlier) !== canonical(product)) {
        throw new Error("Conflicting duplicate product identity")
      }
      if (typeof group.name === "string" && Number.isSafeInteger(product?.product_type))
        categoryNames[product.product_type as number] = group.name.trim()
    }
  }
  return { products, categoryNames }
}

/** The newest 20 products (the API's page size cap) and the catalogue total. */
export async function fetchWelpFirstPage(): Promise<{ products: WelpProduct[]; total: number }> {
  const body = (await get("/products?page=1&page_size=20")) as {
    count?: unknown
    results?: unknown
  }
  if (!Array.isArray(body?.results) || !Number.isSafeInteger(body.count))
    throw new Error("Invalid catalogue page")
  return { products: body.results as WelpProduct[], total: body.count as number }
}

export async function fetchWelpProduct(productId: number): Promise<WelpProduct> {
  if (!Number.isSafeInteger(productId) || productId <= 0)
    throw new Error("Invalid product identity")
  const body = (await get(`/products/${productId}`)) as { data?: WelpProduct }
  if (body?.data?.id !== productId) throw new Error("Mismatched product")
  return body.data
}
