/*
 * Wishlist storage adapter. For now the wishlist lives in this browser's
 * localStorage, signed in or out; WishlistProvider and its components only
 * use these functions.
 *
 * Planned (Step 3B, once the company Products API provides the final
 * product identifiers; deliberately not built on the mock catalogue ids):
 * - signed out: this localStorage store, unchanged;
 * - signed in: a Supabase wishlist table owned by auth.uid() (RLS), keyed
 *   by the Products API identifier, with no foreign key to any product table;
 * - after sign-in: local ids are merged into the account (union, oldest
 *   first) and the local copy is cleared.
 * The provider would pick the store by session and keep the same id list.
 */

import { productSource } from "./catalog"

/*
 * Each catalogue keeps its own list, so switching to the live catalogue never
 * shows (or deletes) wishlists saved against the mock catalogue: the mock
 * list stays under its original key, untouched. The live list holds only
 * company product ids ("14092").
 */
const STORAGE_KEY =
  productSource === "live" ? "perfumeria:wishlist:live" : "perfumeria:wishlist"
const isValidId = (id: unknown): id is string =>
  typeof id === "string" && (productSource !== "live" || /^[1-9]\d{0,15}$/.test(id))

/** Product ids, oldest first, without duplicates. Never throws. */
export function loadWishlist(): string[] {
  try {
    const stored: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    )
    if (!Array.isArray(stored)) return []
    return [
      ...new Set(stored.filter(isValidId)),
    ]
  } catch {
    // Unavailable storage (private mode, blocked site data) or corrupt JSON.
    return []
  }
}

export function saveWishlist(productIds: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(productIds))
  } catch {
    // The wishlist still works for this visit; it just is not remembered.
  }
}

/** Calls `onChange` when another tab changes the stored wishlist. */
export function subscribeToWishlist(onChange: (productIds: string[]) => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null)
      onChange(loadWishlist())
  }
  window.addEventListener("storage", handleStorage)
  return () => window.removeEventListener("storage", handleStorage)
}
