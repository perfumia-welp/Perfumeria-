import type { Messages } from "@/i18n/messages"
import type { OrderErrorCode } from "@/services/orders"

/** What to tell the customer when /api/orders did not accept the order. */
export function orderErrorMessage(
  t: Messages,
  error: OrderErrorCode | undefined,
  unavailableName: string | undefined,
) {
  const errors = t.checkout.errors
  switch (error) {
    case "unavailable_product":
      return unavailableName
        ? errors.unavailable(unavailableName)
        : errors.unavailableUnnamed
    case "invalid_order":
    case "invalid_product":
    case "invalid_option":
    case "option_required":
    case "duplicate_line":
      return errors.invalidItems
    case "rate_limited":
      return errors.rateLimited
    case "session_expired":
      return errors.sessionExpired
    case "order_locked":
      return errors.locked
    case "order_rules_unavailable":
      return t.cart.checkoutUnavailable
    default:
      return errors.failed
  }
}
