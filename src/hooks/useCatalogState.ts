import { useSyncExternalStore } from "react"
import {
  getCatalogState,
  getCatalogVersion,
  subscribeCatalog,
} from "@/services/catalog"

/**
 * Re-renders when the catalogue changes (the full live catalogue arrives
 * after the first page, a background refresh, a product detail) and returns
 * its state. Include `version` in memo dependencies over catalogue data.
 */
export function useCatalogState() {
  const version = useSyncExternalStore(subscribeCatalog, getCatalogVersion)
  return { ...getCatalogState(), version }
}
