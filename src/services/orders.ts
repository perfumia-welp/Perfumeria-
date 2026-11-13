import { loadSupabase } from "@/lib/supabase"
import type { OrderRequest } from "@/types/order"

/** Error codes from /api/orders (server/orders.mjs), plus client-side ones. */
export type OrderErrorCode =
  | "price_changed"
  | "unavailable_product"
  | "rate_limited"
  | "session_expired"
  | "order_locked"
  | "invalid_order"
  | "invalid_product"
  | "invalid_option"
  | "option_required"
  | "duplicate_line"
  | "minimum_order_not_met"
  | "catalogue_unavailable"
  | "storage_unavailable"
  | "unavailable"
  | "order_unavailable"

export interface OrderResult {
  ok: boolean
  /** The stored order; with "price_changed", the corrected quote to confirm. */
  order?: OrderRequest
  emailState?: "success" | "error" | "unavailable" | "sending"
  /** True when this was an edited resubmit of a stored reference. */
  updated?: boolean
  error?: OrderErrorCode
  /** "unavailable_product": the product's English and Arabic display names. */
  name?: string
  nameAr?: string
  /**
   * "minimum_order_not_met": the minimum and the server-verified amount the
   * customer would pay (product subtotal after the Buy 3 promotion).
   */
  minimum?: number
  subtotal?: number
  currency?: string
}

/** Success requires the Node server to commit the verified order. */
export async function submitOrder(order: OrderRequest): Promise<OrderResult> {
  try {
    const client = await loadSupabase()
    const session = await client?.auth.getSession()
    const token = session?.data.session?.access_token
    if (!token) return { ok: false, error: "session_expired" }
    const response = await fetch(`${import.meta.env.BASE_URL}api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(order),
      signal: AbortSignal.timeout(90000),
    })
    if (!response.headers.get("content-type")?.includes("application/json"))
      return { ok: false, error: "unavailable" }
    const result = (await response.json()) as OrderResult
    if (!response.ok) return { ...result, ok: false }
    return result.ok && result.order ? result : { ok: false, error: "unavailable" }
  } catch {
    return { ok: false, error: "order_unavailable" }
  }
}
