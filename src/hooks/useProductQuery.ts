import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router"
import { parseProductQuery, toSearchParams } from "@/services/catalog"
import type { Gender, ProductQuery } from "@/types/catalog"

/**
 * Product listing state, read from and written to the URL query string, so
 * filtered views are shareable and work with back/forward. Any change other
 * than View More returns to the first batch (page 1).
 *
 * On a collection page (/men-perfumes) the gender is the page itself: it is
 * always applied, never written to the URL and not counted as a filter.
 */
export default function useProductQuery(collection?: Gender) {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => {
    const parsed = parseProductQuery(searchParams)
    return collection ? { ...parsed, genders: [collection] } : parsed
  }, [searchParams, collection])

  const update = useCallback(
    (changes: Partial<ProductQuery>) => {
      const next = { ...query, page: 1, ...changes }
      if (collection) next.genders = []
      setSearchParams(toSearchParams(next), { preventScrollReset: true })
    },
    [query, setSearchParams, collection],
  )

  /**
   * View More: one more batch of the same list. `page` counts the batches
   * shown (page=3 shows products 1–36). It replaces the history entry, so
   * Back leaves the listing instead of un-revealing, and keeps the scroll.
   */
  const showMore = useCallback(() => {
    const next = { ...query, page: query.page + 1 }
    if (collection) next.genders = []
    setSearchParams(toSearchParams(next), {
      replace: true,
      preventScrollReset: true,
    })
  }, [query, setSearchParams, collection])

  const clearFilters = useCallback(() => {
    update({
      genders: [],
      families: [],
      availability: undefined,
      priceRange: undefined,
      brands: [],
    })
  }, [update])

  /** Clears filters and the search term in one navigation (sort is kept). */
  const clearAll = useCallback(() => {
    update({
      search: undefined,
      genders: [],
      families: [],
      availability: undefined,
      priceRange: undefined,
      brands: [],
    })
  }, [update])

  const activeFilterCount =
    (collection ? 0 : query.genders.length) +
    query.families.length +
    query.brands.length +
    (query.availability ? 1 : 0) +
    (query.priceRange ? 1 : 0)

  return { query, update, showMore, clearFilters, clearAll, activeFilterCount }
}
