import { useState } from "react"
import { useI18n } from "@/i18n/i18nContext"
import { getSortOptions } from "@/services/catalog"
import type { SortOption } from "@/types/catalog"
import FilterMenu from "./FilterMenu"
import FilterOptions from "./FilterOptions"
import MobileFilters from "./MobileFilters"
import type { FilterGroup } from "./filterGroups"
import "./ProductToolbar.css"

interface ProductToolbarProps {
  groups: FilterGroup[]
  sort: SortOption
  onSortChange: (sort: SortOption) => void
  activeFilterCount: number
  onClearFilters: () => void
  resultCount: number
  /** The result count in words, once it is known (left of Sort). */
  summary?: string
}

/**
 * The bar above the grid. Desktop (1024px and wider): the result count and
 * Sort; the filters live in the sidebar (FilterSidebar). Below 1024px: a
 * "Filters" button opening the same groups in a sheet, and Sort.
 */
export default function ProductToolbar({
  groups,
  sort,
  onSortChange,
  activeFilterCount,
  onClearFilters,
  resultCount,
  summary,
}: ProductToolbarProps) {
  const [sortOpen, setSortOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { t, locale } = useI18n()
  const copy = t.products.toolbar
  const sortOptions = getSortOptions(locale)
  const sortLabel = sortOptions.find((option) => option.value === sort)?.label

  return (
    <div className="product-toolbar" role="region" aria-label={copy.label}>
      {groups.length > 0 && (
        <button
          type="button"
          className="product-toolbar__mobile-filter"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
        >
          {copy.filters}
          {activeFilterCount > 0 && ` (${activeFilterCount})`}
        </button>
      )}

      {summary && (
        <p className="product-toolbar__summary" aria-hidden="true">
          {summary}
        </p>
      )}

      <FilterMenu
        label={copy.sortBy}
        value={sortLabel}
        align="end"
        className="product-toolbar__sort"
        open={sortOpen}
        onOpenChange={setSortOpen}
      >
        <FilterOptions
          legend={copy.sortBy}
          options={sortOptions}
          selected={[sort]}
          mode="single"
          showCounts={false}
          hideLegend
          onChange={([value]) => {
            onSortChange(value as SortOption)
            setSortOpen(false)
          }}
        />
      </FilterMenu>

      <MobileFilters
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        groups={groups}
        activeFilterCount={activeFilterCount}
        onClearFilters={onClearFilters}
        resultCount={resultCount}
      />
    </div>
  )
}
