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

/**
 * The sale a card may show for a product whose price depends on one required
 * main-price choice (with box / without box) before the customer picks: the
 * cheapest payable option, with that same option's own Welp "before" price.
 * It never mixes two options or uses the product-level "before"; when the
 * cheapest option is not itself discounted there is no sale. Undefined while
 * the options are unknown, or when the price depends on anything else.
 */
export function cheapestOptionSale(product: Pick<Product, "variations">) {
  const required = (product.variations ?? []).filter((variation) => variation.required)
  if (required.length !== 1 || !required[0].replacesPrice) return undefined
  let cheapest: { price: number; compareAtPrice?: number } | undefined
  for (const option of required[0].options) {
    if (typeof option.price !== "number" || !Number.isFinite(option.price)) continue
    if (!cheapest || option.price < cheapest.price)
      cheapest = { price: option.price, compareAtPrice: option.compareAtPrice }
  }
  if (!cheapest) return undefined
  const sale = productSale(cheapest)
  return sale ? { ...sale, price: cheapest.price } : undefined
}

type CardProduct = Pick<
  Product,
  "price" | "compareAtPrice" | "requiresOptionSelection" | "selectedOptions" | "variations"
>

/**
 * The sale a product card shows: the product's own, or, for a product whose
 * price waits on a required option, its cheapest option's (cheapestOptionSale)
 * from the product's options or, when the listing has none, its loaded
 * detail. Undefined while those options are unknown.
 */
export function cardSale(product: CardProduct, detail?: Pick<Product, "variations">) {
  const needsChoice =
    product.requiresOptionSelection === true && !product.selectedOptions
  if (!needsChoice) return productSale(product) ?? undefined
  return cheapestOptionSale(product.variations?.length ? product : (detail ?? product))
}

/**
 * The highest whole percentage among these card sales (the "Up to X%" of
 * the homepage sale highlight). Undefined when none of them shows one.
 */
export function highestSalePercentage(
  sales: Iterable<{ percentage?: number } | null | undefined>,
) {
  let highest: number | undefined
  for (const sale of sales) {
    const percentage = sale?.percentage
    if (percentage !== undefined && (highest === undefined || percentage > highest))
      highest = percentage
  }
  return highest
}
