import orderRules from "../../shared/orderRules.json" with { type: "json" }

/**
 * Minimum product subtotal for an order, in the catalogue currency (EGP).
 * The value lives in shared/orderRules.json, which server/orders.mjs reads
 * too, so the bag, checkout and POST /api/orders always agree. Shipping and
 * delivery never count towards it.
 */
export const MINIMUM_ORDER_SUBTOTAL: number = orderRules.minimumOrderSubtotal

/**
 * How much more product subtotal the bag needs before checkout, or 0 once it
 * meets the minimum. Worked in cents, so a cent short is never rounded away.
 * `minimum` is the shared value, or the one the server reported.
 */
export function minimumOrderShortfall(
  subtotal: number,
  minimum: number = MINIMUM_ORDER_SUBTOTAL,
) {
  const missing = Math.round(minimum * 100) - Math.round(subtotal * 100)
  return missing > 0 ? missing / 100 : 0
}
