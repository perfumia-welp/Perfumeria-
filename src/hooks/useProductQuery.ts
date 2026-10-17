import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router"
import { parseProductQuery, toSearchParams } from "@/services/catalog"
import type { ProductQuery } from "@/types/catalog"

/**
 * Product listing state, read from and written to the URL query string, so
 * filtered views are shareable and work with back/forward. Any change other
 * than paging returns to page 1.
 */
export default function useProductQuery() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => parseProductQuery(searchParams), [searchParams])

  const update = useCallback(
    (changes: Partial<ProductQuery>) => {
      const next = { ...query, page: 1, ...changes }
      setSearchParams(toSearchParams(next), { preventScrollReset: true })
    },
    [query, setSearchParams],
  )

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
    query.genders.length +
    query.families.length +
    query.brands.length +
    (query.availability ? 1 : 0) +
    (query.priceRange ? 1 : 0)

  return { query, update, clearFilters, clearAll, activeFilterCount }
}
