import { createContext, useContext } from "react"
import type { Product } from "@/types/catalog"

/**
 * Saved fragrances. Consumers use only this interface; where the list is
 * stored is the provider's concern (see services/wishlist.ts).
 */
export interface WishlistContextValue {
  /** Saved products that exist in the catalogue, oldest first. */
  products: Product[]
  count: number
  has: (productId: string) => boolean
  add: (product: Product) => void
  remove: (productId: string) => void
  /** Adds or removes, and returns whether the product is now saved. */
  toggle: (product: Product) => boolean
}

export const WishlistContext = createContext<WishlistContextValue | null>(null)

export function useWishlist() {
  const context = useContext(WishlistContext)
  if (!context)
    throw new Error("useWishlist must be used within WishlistProvider")
  return context
}
