/*
 * Order request sent from checkout to the server (/api/orders), which
 * answers with the verified, stored version: names, prices, totals and
 * currency from the company catalogue. The WhatsApp message and email are
 * built from that stored version. Shipping and payment can be added later
 * without changing the checkout UI.
 * Named interfaces only (oxfmt 0.2.0 mangles single-line object types).
 */

/** Only "requested" exists today: the store confirms every order by hand. */
export type OrderStatus = "requested"

/** The language the customer used at checkout ("en" | "ar"). */
export type OrderLocale = "en" | "ar"

export interface OrderCustomer {
  fullName: string
  phone: string
  email: string
  /** Supabase user id when the customer was signed in, otherwise null. */
  userId: string | null
}

export interface OrderDelivery {
  address: string
  cityArea: string
}

/** A chosen catalogue option (e.g. with or without box). */
export interface OrderLineOption {
  variationId: number
  optionId: number
  /** English label; set by the server. */
  label?: string
  /** The catalogue label as given (Arabic); set by the server. */
  labelAr?: string
}

export interface OrderLine {
  /** Company catalogue product id; the server reads the product by it. */
  welpProductId?: number
  options?: OrderLineOption[]
  productId: string
  /** The company English name with options: the canonical record. */
  name: string
  /** Arabic display name (approved Arabic name, else the English); set by the server. */
  nameAr?: string
  /** e.g. "50 ml"; null when the product has no size. */
  size: string | null
  quantity: number
  /** The verified catalogue price of one unit; never lowered by a promotion. */
  unitPrice: number
  /** quantity × unitPrice, before any promotion. */
  lineTotal: number
  /** Units of this line made free by the Buy 3 promotion; set by the server. */
  freeQuantity?: number
  /** freeQuantity × unitPrice; set by the server. */
  promotionDiscount?: number
  /** Packshot at the time, kept with the account's order history. */
  imageUrl: string | null
}

/**
 * Buy 3 — Cheapest Item Free, as the server calculated it on the verified
 * prices. Null when the order has fewer than 3 units.
 */
export interface OrderPromotion {
  id: "buy3-cheapest-free"
  /** English name, for the company's records. */
  name: string
  freeUnits: number
  discount: number
  /** subtotal − discount: what the customer pays for the products. */
  payableSubtotal: number
}

export interface OrderGift {
  /** Empty message = marked as a gift without a note. */
  message: string
}

export interface OrderPromo {
  code: string
  /** Codes are recorded for the store to review, never applied in the browser. */
  status: "entered-not-applied"
}

/** Future: calculated shipping. Null until the store confirms it. */
export interface OrderShipping {
  method: string
  amount: number
}

/** Future: online payment. Null while orders are confirmed manually. */
export interface OrderPayment {
  provider: string
  status: string
  reference: string
}

export interface OrderRequest {
  /** Short reference shared by the WhatsApp message and the email. */
  reference: string
  /** When it was stored (the browser's time until the server answers). */
  createdAt: string
  /** 1, then one more for each edited resubmit of the reference; set by the server. */
  revision?: number
  status: OrderStatus
  /** Language of the checkout; the order message is written in it. */
  locale: OrderLocale
  customer: OrderCustomer
  delivery: OrderDelivery
  notes: string | null
  lines: OrderLine[]
  currency: string
  /** Product subtotal at the verified prices, before the promotion. */
  subtotal: number
  /**
   * The automatic Buy 3 promotion. Only the server's value counts: what the
   * browser sends here is never read.
   */
  promotion?: OrderPromotion | null
  /** The total the customer saw: the subtotal minus the promotion. */
  displayedTotal: number
  gift: OrderGift | null
  promo: OrderPromo | null
  shipping: OrderShipping | null
  /** Always 0 (ORDER_TAX); null only on requests made before 2026-11-13. */
  tax: number | null
  payment: OrderPayment | null
}
