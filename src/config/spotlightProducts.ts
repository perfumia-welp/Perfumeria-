/*
 * Products shown in the Offer Spotlight, by live company (Welp) product id.
 *
 * Each image is a transparent cut-out of that product's own Welp photograph
 * (the `image` field of /all-products and /products/{id}): background,
 * pedestal and props removed by a segmentation model, the bottle itself
 * untouched, trimmed and saved as WebP with alpha at 360 px tall. Made
 * 2026-11-14 from:
 *
 *   11387  .../businessproducts/12-08-2026/1786539596.jpg
 *   11522  .../businessproducts/14-08-2026/1786669096.jpg
 *   11430  .../businessproducts/13-08-2026/1786583147.jpeg
 *   13965  .../businessproducts/21-09-2026/1790029097.jpg
 *   13971  .../businessproducts/21-09-2026/1790029637.jpg
 *
 * The card checks every entry against the live catalogue before showing it
 * (OfferSpotlight `useSpotlightProducts`): a product that is gone, sold out
 * or, for the sale offer, no longer discounted is simply left out. Nothing
 * is ever substituted.
 */
export interface SpotlightProduct {
  productId: number
  src: string
  width: number
  height: number
}

const product = (productId: number, width: number, height: number): SpotlightProduct => ({
  productId,
  src: `/images/spotlight/${productId}.webp`,
  width,
  height,
})

/** Buy 3 offer: three regular-price products, back to front. */
export const BUY3_PRODUCTS: SpotlightProduct[] = [
  // Tom Ford Tobacco Vanille (behind, centre)
  product(11387, 170, 360),
  // Chanel No. 5 Eau de Parfum (front, start)
  product(11522, 212, 360),
  // Chanel Allure Homme Sport (front, end)
  product(11430, 230, 360),
]

/** Sale offer: two genuinely discounted products, back to front. */
export const SALE_PRODUCTS: SpotlightProduct[] = [
  // Jean Paul Gaultier Scandal EDP (behind)
  product(13971, 174, 360),
  // Narciso Rodriguez Narciso Rouge (front)
  product(13965, 258, 360),
]
