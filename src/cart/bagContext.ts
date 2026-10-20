import { createContext, useContext } from "react"
import type { Product } from "@/types/catalog"
import type { CartItem } from "@/types/commerce"

/**
 * Bag state. Signed-in customers' lines live in Supabase (services/cart.ts);
 * a visitor without an account keeps the bag for this visit only.
 */
export interface BagContextValue {
  /** Lines that can be ordered, with their current catalogue product. */
  items: CartItem[]
  /**
   * Lines whose product or option no longer exists or is sold out. Shown in
   * the bag so they can be removed; never part of `items` or an order.
   */
  unavailableItems: UnavailableBagLine[]
  /** False while the saved bag or its products are still loading. */
  isReady: boolean
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

export interface UnavailableBagLine {
  id: string
  quantity: number
  /** The name, when it is still known. */
  name?: string
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
