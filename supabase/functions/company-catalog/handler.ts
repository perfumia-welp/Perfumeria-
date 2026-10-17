// DORMANT FALLBACK — not used, not deployed. The company API is public (no
// token, header App-ID: WEBSITE) and allows any origin, so the browser reads it
// directly (src/services/products/welp.ts). Keep this read-only proxy for if a
// server hop becomes useful: server-side caching, rate limiting, a CORS change
// on the company side, or upstream API changes hidden from the storefront.
import { normalizeProduct, type WelpProduct } from "../../../src/services/products/adapter.ts"

export type ReadOperation =
  | { kind: "list-products" }
  | { kind: "get-product"; productId: number }
  | { kind: "list-categories" }

export interface ServerConfig {
  baseUrl: string
  businessId: number
  /** Only if the company ever requires one; the public API does not. */
  token?: string
  currency: string
  mediaOrigin?: string
  allowedOrigin: string
}

/** Implement only after exact GET paths, auth scheme, pagination and envelopes
 * are confirmed. This interface cannot carry a client path, method or headers. */
export type CompanyReader = (operation: ReadOperation, config: ServerConfig) => Promise<unknown>

function safeProduct(value: unknown, config: ServerConfig): WelpProduct {
  const row = value as WelpProduct
  // Validation fails closed (identity, prices, image, options).
  normalizeProduct(row, config, "en")
  return {
    id: row.id, product_type: row.product_type, name: row.name, description: row.description,
    price_before_discount: row.price_before_discount, price_after_discount: row.price_after_discount,
    image: row.image, is_available: row.is_available, is_variation_available: row.is_variation_available,
    ...(Array.isArray(row.variations) ? {
      variations: row.variations.map((v) => ({
        id: v.id, name: v.name, is_required: v.is_required, is_select_multiple: v.is_select_multiple,
        min_selection: v.min_selection, max_selection: v.max_selection, is_main_price: v.is_main_price,
        options: v.options.map((o) => ({
          id: o.id, name: o.name, additional_price: o.additional_price,
          price_before_discount: o.price_before_discount, price_after_discount: o.price_after_discount,
        })),
      })),
    } : {}),
  }
}

export function createCatalogHandler(config: ServerConfig | null, read?: CompanyReader) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("Origin")
    const headers: Record<string, string> = {
      "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    }
    if (config && origin === config.allowedOrigin) headers["Access-Control-Allow-Origin"] = origin
    const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers })
    if (origin && config && origin !== config.allowedOrigin) return reply(403, { error: "Origin not allowed" })
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers })
    if (request.method !== "GET") return reply(405, { error: "Read-only catalogue", allowed: ["GET"] })
    const params = new URL(request.url).searchParams
    if ([...params.keys()].some((key) => !["operation", "productId"].includes(key)) || [...new Set(params.keys())].some((key) => params.getAll(key).length !== 1)) return reply(400, { error: "Unsupported parameters" })
    const kind = params.get("operation")
    if (kind !== "list-products" && kind !== "get-product" && kind !== "list-categories") return reply(400, { error: "Unsupported operation" })
    const id = params.get("productId")
    if (kind === "get-product" ? !id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) : id !== null) return reply(400, { error: "Invalid product identity" })
    // This remains unavailable even with secrets until a verified reader is installed.
    if (!config || !read) return reply(503, { error: "Catalogue is not configured" })
    try {
      const url = new URL(config.baseUrl)
      if (url.protocol !== "https:" || url.username || url.password || !Number.isSafeInteger(config.businessId) || config.businessId <= 0) throw new Error("Invalid configuration")
      const operation: ReadOperation = kind === "get-product" ? { kind, productId: Number(id) } : { kind }
      const data = await read(operation, config)
      const publicConfig = { businessId: config.businessId, currency: config.currency, mediaOrigin: config.mediaOrigin }
      if (kind === "list-products") {
        if (!Array.isArray(data)) throw new Error("Invalid catalogue")
        return reply(200, { config: publicConfig, products: data.map((row) => safeProduct(row, config)) })
      }
      if (kind === "get-product") {
        const product = safeProduct(data, config)
        if (product.id !== Number(id)) throw new Error("Mismatched product")
        return reply(200, { config: publicConfig, product })
      }
      if (!Array.isArray(data)) throw new Error("Invalid categories")
      const categories = data.map((row) => {
        if (!Number.isSafeInteger(row.id) || row.id <= 0 || (row.name_en != null && typeof row.name_en !== "string") || (row.name_ar != null && typeof row.name_ar !== "string")) throw new Error("Invalid category")
        return { id: row.id, name_en: row.name_en, name_ar: row.name_ar }
      })
      return reply(200, { categories })
    } catch {
      // Never forward upstream response bodies, headers, URLs or exception text.
      return reply(502, { error: "Catalogue request failed" })
    }
  }
}
