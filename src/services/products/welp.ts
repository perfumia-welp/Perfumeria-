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

async function get(path: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LIVE_CATALOG.timeoutMs)
  try {
    const response = await fetch(base + path, {
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
    if (!response.ok) throw new Error("Catalogue request failed")
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

export interface WelpCatalog {
  products: WelpProduct[]
  /** Product type id → its company (English) group name. */
  categoryNames: Record<number, string>
}

export async function fetchWelpCatalog(): Promise<WelpCatalog> {
  const body = (await get("/all-products")) as {
    data?: { name?: unknown; products?: unknown }[]
  }
  if (!Array.isArray(body?.data)) throw new Error("Invalid catalogue")
  const products: WelpProduct[] = []
  const categoryNames: Record<number, string> = {}
  for (const group of body.data) {
    if (!Array.isArray(group?.products)) throw new Error("Invalid catalogue")
    for (const product of group.products as WelpProduct[]) {
      products.push(product)
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
