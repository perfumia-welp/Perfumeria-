/*
 * Customer account data stored in Supabase (profiles, addresses, order
 * history). Products are not stored here: they come from the company's
 * Products API. Named interfaces only (oxfmt 0.2.0 mangles single-line
 * object types).
 */

/** public.profiles: editable personal details. Email stays in Supabase Auth. */
export interface CustomerProfile {
  firstName: string
  lastName: string
  phone: string
}

/** The fields a customer fills in for an address. */
export interface AddressInput {
  /** Optional name such as "Home" or "Office"; "" when not given. */
  label: string
  fullName: string
  phone: string
  address: string
  cityArea: string
  isDefault: boolean
}

/** public.addresses: a saved delivery address. */
export interface SavedAddress extends AddressInput {
  id: string
}

/**
 * The only status today: the store confirms every request by hand. Store-side
 * statuses are added later, from a real store status source.
 */
export type OrderHistoryStatus = "request_created"

/** public.order_items: a product snapshot as it was when the order was placed. */
export interface OrderHistoryItem {
  position: number
  /** Catalogue id at the time; not linked to any table. */
  productRef: string
  name: string
  /** e.g. "75 ml"; null when the product had no size. */
  size: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  imageUrl: string | null
}

/** public.orders: an order request in the customer's history. */
export interface OrderHistoryEntry {
  id: string
  reference: string
  /** Local calendar date it was placed (YYYY-MM-DD). */
  placedOn: string
  status: OrderHistoryStatus
  subtotal: number
  currency: string
  items: OrderHistoryItem[]
}

/** Why an account request failed. */
export type AccountErrorCode = "unavailable" | "failed" | "address_limit"

export interface AccountSuccess<T> {
  ok: true
  data: T
}

export interface AccountFailure {
  ok: false
  error: AccountErrorCode
}

export type AccountResult<T> = AccountSuccess<T> | AccountFailure
