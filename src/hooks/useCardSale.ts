import { useProductDetail } from "@/hooks/useProductDetail"
import { cardSale } from "@/lib/productSale"
import type { Product } from "@/types/catalog"

/**
 * The sale a product card shows (cardSale): the product's own, or, for a
 * product whose price waits on a required option, its cheapest option's.
 * Cards and search use this; the product page shows the picked option's sale.
 */
export function useCardSale(product: Product) {
  const needsChoice =
    product.requiresOptionSelection === true && !product.selectedOptions
  const detail = useProductDetail(
    needsChoice && !product.variations?.length ? product : undefined,
  )
  return cardSale(product, detail)
}
