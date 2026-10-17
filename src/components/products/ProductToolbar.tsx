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
}

/**
 * Filter and sort bar. Desktop/tablet: a dropdown per filter group.
 * Mobile: a "Filter" button opening a side sheet, plus the sort dropdown.
 */
export default function ProductToolbar({
  groups,
  sort,
  onSortChange,
  activeFilterCount,
  onClearFilters,
  resultCount,
}: ProductToolbarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const menuProps = (id: string) => ({
    open: openMenu === id,
    onOpenChange: (open: boolean) => setOpenMenu(open ? id : null),
  })

  const { t, locale } = useI18n()
  const copy = t.products.toolbar
  const sortOptions = getSortOptions(locale)
  const sortLabel = sortOptions.find((option) => option.value === sort)?.label

  return (
    <div className="product-toolbar" role="region" aria-label={copy.label}>
      <div className="product-toolbar__filters">
        {groups.length > 0 && (
          <span className="product-toolbar__label" aria-hidden="true">
            {copy.filterBy}
          </span>
        )}
        {groups.map((group) => (
          <FilterMenu
            key={group.id}
            label={group.label}
            value={
              group.selected.length ? String(group.selected.length) : undefined
            }
            valueDescription={copy.selected}
            {...menuProps(group.id)}
          >
            <FilterOptions
              legend={group.label}
              options={group.options}
              selected={group.selected}
              mode={group.mode}
              allLabel={group.mode === "single" ? copy.all : undefined}
              onChange={group.onChange}
              hideLegend
            />
          </FilterMenu>
        ))}
        {activeFilterCount > 0 && (
          <button
            type="button"
            className="product-toolbar__clear"
            onClick={onClearFilters}
          >
            {copy.clearAll}
          </button>
        )}
      </div>

      {groups.length > 0 && (
        <button
          type="button"
          className="product-toolbar__mobile-filter"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
        >
          {copy.filter}
          {activeFilterCount > 0 && ` (${activeFilterCount})`}
        </button>
      )}

      <FilterMenu
        label={copy.sortBy}
        value={sortLabel}
        align="end"
        className="product-toolbar__sort"
        {...menuProps("sort")}
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
            setOpenMenu(null)
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
