import type { BagGift } from "@/cart/bagContext"
import { company, whatsappDigits } from "@/config/company"
import type { Locale } from "@/i18n/locales"
import type { Messages } from "@/i18n/messages"
import { formatPrice } from "@/lib/formatPrice"
import type { CartItem } from "@/types/commerce"
import type { OrderRequest } from "@/types/order"

/** Left-to-right and right-to-left marks (U+200E, U+200F). */
const BIDI_MARKS = new RegExp(
  `[${String.fromCharCode(0x200e)}${String.fromCharCode(0x200f)}]`,
  "g",
)

/** Wording of the order message, in the customer's language (checkout.orderMessage). */
export type OrderMessageText = Messages["checkout"]["orderMessage"]

export interface CheckoutDetails {
  fullName: string
  phone: string
  email: string
  address: string
  cityArea: string
  notes: string
}

export interface OrderRequestInput {
  details: CheckoutDetails
  items: CartItem[]
  gift: BagGift
  promoCode: string
  userId: string | null
  /** The language the customer checked out in. */
  locale: Locale
  /** Reuse this reference (an edited resubmit); a new one is made when absent. */
  reference?: string
}

/** "PF-261006-K7Q2": date plus four random characters, easy to read aloud. */
function createReference(date: Date) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const random = crypto.getRandomValues(new Uint8Array(4))
  const suffix = Array.from(random, (byte) => alphabet[byte % alphabet.length])
  const stamp = [date.getFullYear() % 100, date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("")
  return `PF-${stamp}-${suffix.join("")}`
}

const formatSize = (size?: string) => (size ? size.replace(/ml$/, " ml") : null)

/** Snapshot of the bag and the customer's details as one typed request. */
export function buildOrderRequest({
  details,
  items,
  gift,
  promoCode,
  userId,
  locale,
  reference,
}: OrderRequestInput): OrderRequest {
  const now = new Date()
  const lines = items.map(({ product, quantity }) => ({
    productId: product.id,
    name: product.name,
    size: formatSize(product.size),
    quantity,
    unitPrice: product.price,
    lineTotal: product.price * quantity,
    imageUrl: product.packshot.src || null,
  }))
  const subtotal = lines.reduce((total, line) => total + line.lineTotal, 0)
  const code = promoCode.trim()
  const notes = details.notes.trim()

  return {
    reference: reference ?? createReference(now),
    createdAt: now.toISOString(),
    status: "requested",
    locale,
    customer: {
      fullName: details.fullName.trim(),
      phone: details.phone.trim(),
      email: details.email.trim(),
      userId,
    },
    delivery: {
      address: details.address.trim(),
      cityArea: details.cityArea.trim(),
    },
    notes: notes || null,
    lines,
    currency: items[0]?.product.currency ?? "USD",
    subtotal,
    displayedTotal: subtotal,
    gift: gift.isGift ? { message: gift.message.trim() } : null,
    promo: code ? { code, status: "entered-not-applied" } : null,
    shipping: null,
    tax: null,
    payment: null,
  }
}

/**
 * Plain-text order message in the customer's language; *asterisks* render
 * as bold in WhatsApp. In Arabic every line starts right to left and
 * technical values (reference, phone, email, code, prices) are isolated
 * left to right, so plain-text apps keep them readable.
 */
export function orderWhatsAppMessage(
  order: OrderRequest,
  text: OrderMessageText,
) {
  // Prices are placed inside left-to-right isolates by the wording (text.ltr),
  // so the direction marks used on the page are dropped here.
  const price = (amount: number) =>
    formatPrice(amount, order.currency, order.locale).replace(BIDI_MARKS, "")
  const { customer, delivery } = order
  const { ltr } = text

  const lines = order.lines.flatMap((line, index) => [
    text.item(index + 1, line.name, line.size),
    text.quantity(line.quantity, price(line.unitPrice), price(line.lineTotal)),
  ])

  const extras = [
    order.gift &&
      (order.gift.message
        ? text.giftMessage(order.gift.message)
        : text.giftNoMessage),
    order.promo && text.promo(order.promo.code),
    order.notes && text.notes(order.notes),
  ].filter((extra): extra is string => Boolean(extra))

  return [
    `*${text.title(order.reference)}*`,
    "",
    `*${text.customer}*`,
    `${text.name}: ${customer.fullName}`,
    `${text.phone}: ${ltr(customer.phone)}`,
    `${text.email}: ${ltr(customer.email)}`,
    "",
    `*${text.delivery}*`,
    `${text.address}: ${delivery.address}`,
    `${text.cityArea}: ${delivery.cityArea}`,
    "",
    `*${text.order}*`,
    ...lines,
    "",
    `${text.subtotal}: ${ltr(price(order.subtotal))}`,
    `${text.shipping}: ${text.confirmedByStore}`,
    `${text.tax}: ${text.confirmedByStore}`,
    `${text.displayedTotal}: ${ltr(price(order.displayedTotal))}`,
    ...(extras.length ? ["", ...extras] : []),
    "",
    text.closing,
  ]
    .map((line) => (line ? text.line(line) : line))
    .join("\n")
}

/**
 * wa.me link with the message prefilled, or null if no number is configured
 * (WhatsApp stays off until the company confirms its number).
 */
export function orderWhatsAppUrl(order: OrderRequest, text: OrderMessageText) {
  if (!whatsappDigits) return null
  return `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
    orderWhatsAppMessage(order, text),
  )}`
}

export interface OrderEmailContent {
  subject: string
  text: string
}

/**
 * The same order message as a plain email (subject and body), shared by the
 * customer's mailto draft and the server email (send-order-request).
 */
export function orderEmailContent(
  order: OrderRequest,
  text: OrderMessageText,
): OrderEmailContent {
  return {
    subject: text.subject(order.reference),
    // WhatsApp's *bold* markers mean nothing in a plain email.
    text: orderWhatsAppMessage(order, text).replace(/\*/g, ""),
  }
}

/**
 * mailto: link that opens the customer's own email app addressed to the
 * store, with the request written out in the customer's language. Used
 * while server-side email delivery is not set up (or fails); nothing is
 * sent until the customer presses Send.
 */
export function orderMailtoUrl(order: OrderRequest, text: OrderMessageText) {
  if (!company.orderEmail) return null
  const email = orderEmailContent(order, text)
  return `mailto:${company.orderEmail}?subject=${encodeURIComponent(
    email.subject,
  )}&body=${encodeURIComponent(email.text)}`
}
