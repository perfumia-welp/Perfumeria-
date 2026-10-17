import type { ServiceResult } from "@/types/commerce"

/*
 * Promotion adapter. No promotion API exists yet, so codes are never applied
 * and this reports "unavailable". The entered code still travels with the
 * order request (see services/orders.ts), marked as not applied. Shipping and
 * tax are never estimated in the frontend.
 */

export async function applyPromoCode(code: string): Promise<ServiceResult> {
  void code
  return { status: "unavailable" }
}
