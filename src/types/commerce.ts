import type { Product } from "./catalog"

/* Cart and contact shapes. Account data types live in ./account. */

export interface CartItem {
  product: Product
  quantity: number
}

export interface ContactFormValues {
  fullName: string
  email: string
  phone: string
  subject: string
  message: string
}

export interface ContactDetail {
  label: string
  lines: string[]
  href?: string
  /** Written left to right in every language (phone numbers). */
  ltr?: boolean
}

/** Outcome of a request to a service that may not be connected yet. */
export type ServiceResult = ServiceSuccess | ServiceUnavailable | ServiceError

export interface ServiceSuccess {
  status: "success"
}

export interface ServiceUnavailable {
  status: "unavailable"
}

export interface ServiceError {
  status: "error"
  message: string
}
