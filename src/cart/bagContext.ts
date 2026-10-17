import { createContext, useContext } from "react"
import type { Product } from "@/types/catalog"
import type { CartItem } from "@/types/commerce"

/**
 * Temporary, session-only bag state.
 * Swap the provider implementation for the real cart API without changing consumers.
 */
export interface BagContextValue {
  items: CartItem[]
  /** Total quantity across all lines (shown in the header badge). */
  itemCount: number
  subtotal: number
  /** Adds `quantity` (default 1) of a product, capped at MAX_QUANTITY per line. */
  addItem: (product: Product, quantity?: number) => void
  setQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  /** The most recently removed line, while it can still be restored. */
  lastRemoved: CartItem | null
  undoRemove: () => void
  /** Forgets the last removed line (the Undo offer expires). */
  clearRemoved: () => void
  /** Gift choice and message, kept with the bag so checkout can include them. */
  gift: BagGift
  setGift: (gift: BagGift) => void
  /** Promo code as typed. Recorded with the order request; never applied here. */
  promoCode: string
  setPromoCode: (code: string) => void
  /** Empties the bag, gift and promo, e.g. once an order request is done. */
  clearBag: () => void
}

export interface BagGift {
  isGift: boolean
  message: string
}

/** Quantity limits for a single bag line. */
export const MIN_QUANTITY = 1
export const MAX_QUANTITY = 10

export const BagContext = createContext<BagContextValue | null>(null)

export function useBag() {
  const context = useContext(BagContext)
  if (!context) throw new Error("useBag must be used within BagProvider")
  return context
}
