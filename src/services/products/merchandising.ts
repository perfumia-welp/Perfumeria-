import type { Product } from "../../types/catalog.ts"

/*
 * The shop's default product order, from the merchant's own data in Welp:
 *
 *   1. Sale: the merchant's Offers selection (`is_offer`; the "Offers" group
 *      of /all-products), in the merchant's Offers order
 *   2. regular perfumes
 *   3. Perfume Sets (company product type 1684, "Boxes")
 *
 * An offer that is also a set counts as Sale. Within regular perfumes and
 * within sets the catalogue's own order (newest first) is kept, as the sort
 * is stable. No product ids are listed anywhere: the merchant changes the
 * order by changing Offers or product types in Welp.
 *
 * Note the difference from a crossed-out price (`compareAtPrice`): most live
 * products have one, so it cannot tell sale products apart; `is_offer` is the
 * merchant's explicit choice.
 */

type Merchandised = Pick<Product, "onOffer" | "offerRank" | "giftSet">

export function merchandisingTier(product: Merchandised) {
  if (product.onOffer) return 0
  return product.giftSet ? 2 : 1
}

/** Comparator for the default (Featured) order. */
export function featuredOrder(a: Merchandised, b: Merchandised) {
  return (
    merchandisingTier(a) - merchandisingTier(b) ||
    (a.onOffer && b.onOffer ? (a.offerRank ?? 0) - (b.offerRank ?? 0) : 0)
  )
}

/** The homepage Offers carousel: Sale, then Perfume Sets (no regular perfumes). */
export function offerCarousel<Item extends Merchandised>(catalog: Item[]): Item[] {
  return catalog.filter((product) => product.onOffer || product.giftSet).sort(featuredOrder)
}
