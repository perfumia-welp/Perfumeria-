/*
 * Bag storage adapter. The bag lives in this browser's localStorage so it
 * survives a refresh, a typed address or a new tab; BagProvider only uses
 * these functions.
 */

import { productSource } from "@/services/catalog"
import { OPTION_SEPARATOR } from "@/services/products/adapter"
import type { CartItem } from "@/types/commerce"
import { MAX_QUANTITY, MIN_QUANTITY } from "./bagContext"

/*
 * Each catalogue keeps its own bag, like the wishlist, so mock lines never
 * appear in (or are wiped by) the live bag. Lines hold a snapshot of the
 * product as added, shown until the catalogue has loaded.
 */
const STORAGE_KEY =
  productSource === "live" ? "perfumeria:bag:live" : "perfumeria:bag"
const STORAGE_VERSION = 1

/** A company product id ("14092"), optionally with picked option ids ("14092~5"). */
const LIVE_LINE_ID = /^[1-9]\d{0,15}(~[1-9]\d{0,15})*$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * A stored line is kept only when it is a complete bag line: a real id,
 * name, price and image, a valid quantity, and (for a product with options)
 * the picked company options its id names.
 */
function isValidLine(value: unknown): value is CartItem {
  if (!isRecord(value) || !isRecord(value.product)) return false
  const { product, quantity } = value
  const id = product.id
  if (typeof id !== "string" || !id) return false
  if (productSource === "live" && !LIVE_LINE_ID.test(id)) return false
  if (typeof product.slug !== "string" || !product.slug) return false
  if (typeof product.name !== "string" || !product.name) return false
  if (typeof product.currency !== "string") return false
  if (typeof product.price !== "number" || !Number.isFinite(product.price) || product.price < 0)
    return false
  if (!isRecord(product.packshot) || typeof product.packshot.src !== "string") return false
  if (!Array.isArray(product.notes)) return false
  if (
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < MIN_QUANTITY ||
    quantity > MAX_QUANTITY
  )
    return false
  // An option product must carry the picks its line id names, never fewer.
  if (product.requiresOptionSelection === true) return false
  const optionIds = id.split(OPTION_SEPARATOR).slice(1)
  const selected = product.selectedOptions
  if (!optionIds.length) return selected === undefined
  return (
    Array.isArray(selected) &&
    selected.length === optionIds.length &&
    selected.every(
      (option, index) =>
        isRecord(option) && String(option.optionId) === optionIds[index],
    )
  )
}

/** Stored bag lines, one per id. Never throws; invalid lines are dropped. */
export function loadBag(): CartItem[] {
  try {
    const stored: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null",
    )
    if (!isRecord(stored) || stored.version !== STORAGE_VERSION) return []
    if (!Array.isArray(stored.items)) return []
    const seen = new Set<string>()
    return stored.items.filter((item): item is CartItem => {
      if (!isValidLine(item) || seen.has(item.product.id)) return false
      seen.add(item.product.id)
      return true
    })
  } catch {
    // Unavailable storage (private mode, blocked site data) or corrupt JSON.
    return []
  }
}

export function saveBag(items: CartItem[]) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, items }),
    )
  } catch {
    // The bag still works for this visit; it just is not remembered.
  }
}

/** Calls `onChange` when another tab changes the stored bag. */
export function subscribeToBag(onChange: (items: CartItem[]) => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange(loadBag())
  }
  window.addEventListener("storage", handleStorage)
  return () => window.removeEventListener("storage", handleStorage)
}
