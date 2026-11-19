import { normEmail, normPhone, normText } from "../../shared/orderChanges.mjs"
import type { BagGift } from "@/cart/bagContext"
import type { OrderRequest } from "@/types/order"

/** What the customer can change while editing a stored order. */
export interface OrderDraft {
  details: {
    fullName: string
    phone: string
    email: string
    address: string
    cityArea: string
    notes: string
  }
  lines: { productId: string; quantity: number }[]
  gift: BagGift
  promoCode: string
}

const giftOf = (gift: { message: string } | null) =>
  gift ? normText(gift.message) : null

/**
 * True when the draft differs from the stored order in an effective value:
 * spacing, Arabic-Indic digits, phone punctuation and email case never count
 * (shared/orderChanges.mjs, the same rules the server's email uses). Prices
 * are not compared: a catalogue change is not the customer's edit, and the
 * server re-quotes them anyway.
 */
export function hasOrderChanges(order: OrderRequest, draft: OrderDraft) {
  const { details } = draft
  if (
    normText(details.fullName) !== normText(order.customer.fullName) ||
    normPhone(details.phone) !== normPhone(order.customer.phone) ||
    normEmail(details.email) !== normEmail(order.customer.email) ||
    normText(details.address) !== normText(order.delivery.address) ||
    normText(details.cityArea) !== normText(order.delivery.cityArea) ||
    normText(details.notes) !== normText(order.notes ?? "")
  )
    return true
  const stored = new Map(order.lines.map((line) => [line.productId, line.quantity]))
  if (
    draft.lines.length !== stored.size ||
    draft.lines.some((line) => stored.get(line.productId) !== line.quantity)
  )
    return true
  const gift = draft.gift.isGift ? { message: draft.gift.message } : null
  if (giftOf(gift) !== giftOf(order.gift)) return true
  return (
    normText(draft.promoCode).toUpperCase() !==
    normText(order.promo?.code ?? "").toUpperCase()
  )
}

/** The editable details of a stored order, to refill the form. */
export const orderDetails = (order: OrderRequest): OrderDraft["details"] => ({
  fullName: order.customer.fullName,
  phone: order.customer.phone,
  email: order.customer.email,
  address: order.delivery.address,
  cityArea: order.delivery.cityArea,
  notes: order.notes ?? "",
})
