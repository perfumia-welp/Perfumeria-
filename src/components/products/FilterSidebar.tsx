import { useEffect, useRef, useState } from "react"
import { useI18n } from "@/i18n/i18nContext"
import FilterOptions from "./FilterOptions"
import type { FilterGroup } from "./filterGroups"
import "./FilterSidebar.css"

/**
 * Desktop filters (1024px and wider): every group as a list of radios or
 * checkboxes beside the grid, applied at once. Below 1024px it is hidden and
 * the same groups open in the Filters sheet (MobileFilters).
 */
export default function FilterSidebar({
  groups,
  activeFilterCount,
  onClearFilters,
}: {
  groups: FilterGroup[]
  activeFilterCount: number
  onClearFilters: () => void
}) {
  const { t } = useI18n()
  const copy = t.products.toolbar

  /*
   * The column follows the scroll (below the sticky header) only while all of
   * it fits the window, so it never becomes a box that needs its own scroll.
   */
  const inner = useRef<HTMLDivElement>(null)
  const [sticky, setSticky] = useState(false)
  useEffect(() => {
    const element = inner.current
    if (!element) return
    const measure = () => {
      // Header + the 24px offset above it (CSS --sidebar-top) + 24px below.
      const header =
        document.querySelector<HTMLElement>(".site-header")?.offsetHeight ?? 0
      setSticky(element.offsetHeight + header + 48 <= window.innerHeight)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener("resize", measure)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [])

  return (
    <aside className="filter-sidebar" aria-labelledby="filter-sidebar-title">
      <div
        ref={inner}
        className={`filter-sidebar__inner${sticky ? " filter-sidebar__inner--sticky" : ""}`}
      >
        <h2 id="filter-sidebar-title" className="filter-sidebar__title">
          {copy.filters}
        </h2>
        {groups.map((group) => (
          <div key={group.id} className="filter-sidebar__group">
            <FilterOptions
              legend={group.label}
              options={group.options}
              selected={group.selected}
              mode={group.mode}
              allLabel={group.mode === "single" ? copy.all : undefined}
              allCount={group.allCount}
              onChange={group.onChange}
            />
          </div>
        ))}
        {groups.length > 0 && (
          <button
            type="button"
            className="filter-sidebar__clear"
            disabled={activeFilterCount === 0}
            onClick={onClearFilters}
          >
            {copy.clearAll}
          </button>
        )}
      </div>
    </aside>
  )
}
