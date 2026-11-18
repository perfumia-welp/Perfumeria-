/*
 * Customer-facing wording for Perfume Boxes products (Welp product type 1684,
 * "Boxes"). The company names many of them "Gift Set" or "... Gift"; the shop
 * calls them perfume sets (owner decision, 2026-11-18). Display only: the
 * company's name and description are never changed, the catalogue keeps them
 * for search, and orders keep the company name as their record beside the
 * display name.
 *
 * Shared by the storefront (src/services/products/adapter.ts) and POST
 * /api/orders (server/orders.mjs), so every surface says the same thing.
 * Products of any other type are returned unchanged, whatever their name.
 */

/** Company product types shown as perfume sets. Same as LIVE_CATALOG.giftSetProductTypes. */
export const PERFUME_SET_PRODUCT_TYPES = Object.freeze([1684])

export const isPerfumeSetType = (productType) =>
  Number.isSafeInteger(productType) && PERFUME_SET_PRODUCT_TYPES.includes(productType)

/** "Gift Set" in the case of the matched text: GIFT SET, gift set, Gift Set. */
const sameCase = (match, replacement) =>
  match === match.toUpperCase() && match !== match.toLowerCase()
    ? replacement.toUpperCase()
    : match === match.toLowerCase()
      ? replacement.toLowerCase()
      : replacement

/** A perfume set's display name, from the company name. */
export function perfumeSetName(name) {
  return String(name)
    // "Perfume Gift (Set)" and "Eau de Parfum/Toilette Gift (Set)" keep their own word.
    .replace(/\b(perfume|fragrance|eau de parfum|eau de toilette)\s+gift(?:\s+set)?\b/gi,
      (match, kind) => `${kind} ${sameCase(match, "Set")}`)
    .replace(/\bgift\s+set\b/gi, (match) => sameCase(match, "Perfume Set"))
    // A name ending in "Gift" (no "Set").
    .replace(/\bgift\s*$/i, (match) => sameCase(match.trim(), "Perfume Set"))
    .replace(/\s{2,}/g, " ")
    .trim()
}

/** A perfume set's description: "gift set" becomes "perfume set" / "fragrance set"; "gift box" stays. */
export function perfumeSetDescription(description) {
  return String(description)
    .replace(/\b(perfume|fragrance|eau de parfum|eau de toilette)\s+gift\s+set\b/gi,
      (match, kind) => `${kind} ${sameCase(match.slice(kind.length).trim(), "Set")}`)
    .replace(/\bgift\s+set\b/gi, (match) => sameCase(match, "Perfume Set"))
}

/** The display name for a company product of `productType`. */
export const displayProductName = (name, productType) =>
  isPerfumeSetType(productType) ? perfumeSetName(name) : name

/** The display description for a company product of `productType`. */
export const displayProductDescription = (description, productType) =>
  isPerfumeSetType(productType) ? perfumeSetDescription(description) : description
