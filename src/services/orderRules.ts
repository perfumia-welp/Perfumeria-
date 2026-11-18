/** The merchant's order rules, as GET /api/order-rules (server/app.mjs) returns them. */
export interface OrderRules {
  /** Minimum payable product subtotal (after the Buy 3, Get the 4th Free promotion; no shipping, no tax). */
  minimumOrderSubtotal: number
  currency: string
}

/**
 * Reads the rules from the site's own server, which reads them from Welp.
 * Throws when they cannot be read; the caller must not assume a minimum.
 */
export async function fetchOrderRules(): Promise<OrderRules> {
  const response = await fetch(`${import.meta.env.BASE_URL}api/order-rules`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`order rules ${response.status}`)
  const body = (await response.json()) as Partial<OrderRules>
  const minimum = body.minimumOrderSubtotal
  if (
    typeof minimum !== "number" ||
    !Number.isFinite(minimum) ||
    minimum < 0 ||
    typeof body.currency !== "string"
  )
    throw new Error("order rules invalid")
  return { minimumOrderSubtotal: minimum, currency: body.currency }
}
