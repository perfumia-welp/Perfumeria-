import type { Gender } from "../types/catalog.ts"

/*
 * Audited gender of individual live products, keyed by company product id.
 *
 * Most products take their gender from their company product type (1344 men,
 * 1382 women: config/catalog.ts). Gift sets (type 1684, "Boxes") have no
 * gender type and the company API has no gender field, so a gift set is
 * Women, Men or Unisex only when it is listed here. An unlisted gift set is
 * still a Gift Set and still in All, but in no gender view: it is never
 * guessed from its name, photo or brand.
 *
 * Add an entry only with evidence: the company's own title or description
 * ("for Him", "for women", "unisex"), or the official manufacturer page.
 * Audit of 2026-11-17 (products 14118–14133): only the three below state
 * their audience; the other 13 do not, and no official manufacturer page
 * states one for those exact sets, so they stay unclassified until the owner
 * confirms them.
 *
 * Precedence (services/products/adapter.ts): Supabase product_metadata
 * gender first, then an entry here, then the product type.
 */
export const LIVE_PRODUCT_GENDER: Record<number, Gender> = {
  // "Rasasi Hawas Gift Set for Him" — "an exclusive men's fragrance gift set"
  14122: "men",
  // "Rasasi Hawas Gift Set for Him" (Kobra / Tropical / Malibu) — "men's fragrance gift set"
  14123: "men",
  // "Laverne Gift Set" — "The perfect collection for women who love … feminine fragrances"
  14128: "women",
}
