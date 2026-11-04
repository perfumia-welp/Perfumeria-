import type { Product } from "../types/catalog.ts"

/** Presentation only. Never derives or changes the customer's selling price. */
export function productSale(product: Pick<Product, "price" | "compareAtPrice" | "requiresOptionSelection" | "selectedOptions">) {
  // A range is not one original/current pair. Wait for an explicit selection.
  if (product.requiresOptionSelection && !product.selectedOptions?.length) return null
  const before = product.compareAtPrice
  const after = product.price
  if (typeof before !== "number" || typeof after !== "number" ||
    !Number.isFinite(before) || !Number.isFinite(after) ||
    before <= 0 || after <= 0 || after >= before) return null
  const rounded = Math.round(((before - after) / before) * 100)
  // Tiny differences and near-free prices must not claim 0% or 100% off.
  return { before, percentage: rounded > 0 && rounded < 100 ? rounded : undefined }
}
