/**
 * How much more payable product subtotal (after the Buy 3 promotion; no
 * shipping, no tax) the bag needs before checkout, or 0 once it meets the
 * minimum. Worked in cents, so a cent short is never rounded away.
 *
 * `minimum` is always the merchant's value from Welp, as GET /api/order-rules
 * (hooks/useOrderRules.ts) or a refused order reported it. The storefront
 * keeps no minimum of its own.
 */
export function minimumOrderShortfall(subtotal: number, minimum: number) {
  const missing = Math.round(minimum * 100) - Math.round(subtotal * 100)
  return missing > 0 ? missing / 100 : 0
}
