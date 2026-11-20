import type { EmailState } from "@/components/checkout/CheckoutConfirmation"
import type { OrderRequest } from "@/types/order"

/**
 * The stored order this tab last saw, per reference: the order page shows it
 * at once (also after a refresh) while it asks the server for the latest
 * version. Only a cache: the server's record is the order.
 */
export interface OrderSession {
  /** The bag owner (guest or account) the order belongs to. */
  owner: string
  order: OrderRequest
  emailState: EmailState
}

const key = (reference: string) => `perfumira:order:${reference}`

export function readOrderSession(reference: string): OrderSession | null {
  try {
    const raw = sessionStorage.getItem(key(reference))
    const state = raw ? (JSON.parse(raw) as OrderSession) : null
    return state?.order?.reference === reference && state.owner ? state : null
  } catch {
    return null
  }
}

export function writeOrderSession(state: OrderSession) {
  try {
    sessionStorage.setItem(key(state.order.reference), JSON.stringify(state))
  } catch {
    /* Optional: the order page then reads the order from the server. */
  }
}
