import type { ValidationKey } from "@/hooks/useValidatedForm"
import type { CheckoutDetails } from "@/lib/orderRequest"
import { isValidOrderEmail, isValidOrderPhone } from "@/lib/validation"

export type OrderDetailsField = keyof CheckoutDetails

export const EMPTY_ORDER_DETAILS: CheckoutDetails = {
  fullName: "",
  phone: "",
  email: "",
  cityArea: "",
  address: "",
  notes: "",
}

/**
 * The customer's details on Checkout and on the order edit form: the same
 * phone and email rules as POST /api/orders (shared/contactRules.mjs).
 */
export function validateOrderDetails(values: CheckoutDetails) {
  const errors: Partial<Record<OrderDetailsField, ValidationKey>> = {}
  if (!values.fullName.trim()) errors.fullName = "fullNameRequired"
  if (!values.phone.trim()) errors.phone = "phoneRequired"
  else if (!isValidOrderPhone(values.phone)) errors.phone = "checkoutPhoneInvalid"
  if (!values.email.trim()) errors.email = "emailRequired"
  else if (!isValidOrderEmail(values.email)) errors.email = "checkoutEmailInvalid"
  if (!values.cityArea.trim()) errors.cityArea = "cityAreaRequired"
  if (!values.address.trim()) errors.address = "streetAddressRequired"
  return errors
}

/*
 * Arabic-Indic (U+0660-0669) and Persian (U+06F0-06F9) digits, as some Arabic
 * keyboards type them, become 0-9 as they are typed.
 */
export const asciiDigits = (value: string) =>
  value.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) =>
    String((digit.charCodeAt(0) - 0x0660) % 0x90),
  )
