import { useI18n } from "@/i18n/i18nContext"
import IconButton from "../ui/IconButton"
import Sheet from "../ui/Sheet"
import FilterOptions from "./FilterOptions"
import type { FilterGroup } from "./filterGroups"
import "./MobileFilters.css"

/** Matches the width at which the inline filter dropdowns return (see ProductToolbar.css). */
const INLINE_FILTERS_QUERY = "(min-width: 768px)"

/** Mobile filter panel: every group at once, applied live, in a side sheet. */
export default function MobileFilters({
  open,
  onClose,
  groups,
  activeFilterCount,
  onClearFilters,
  resultCount,
}: {
  open: boolean
  onClose: () => void
  groups: FilterGroup[]
  activeFilterCount: number
  onClearFilters: () => void
  resultCount: number
}) {
  const { t } = useI18n()
  const copy = t.products
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={copy.mobileFilters.label}
      variant="side"
      className="mobile-filters"
      closeWhen={INLINE_FILTERS_QUERY}
      dismissOnBackdrop
    >
      {(close) => (
        <>
          <div className="mobile-filters__bar">
            <h2 className="mobile-filters__title">
              {copy.mobileFilters.title}
            </h2>
            <IconButton icon="close" label={t.common.close} onClick={close} />
          </div>

          <div className="mobile-filters__groups">
            {groups.map((group) => (
              <FilterOptions
                key={group.id}
                legend={group.label}
                options={group.options}
                selected={group.selected}
                mode={group.mode}
                allLabel={
                  group.mode === "single" ? copy.toolbar.all : undefined
                }
                onChange={group.onChange}
              />
            ))}
          </div>

          <div className="mobile-filters__actions">
            <button
              type="button"
              className="mobile-filters__clear"
              disabled={activeFilterCount === 0}
              onClick={onClearFilters}
            >
              {copy.toolbar.clearAll}
            </button>
            <button type="button" className="button-primary" onClick={close}>
              {copy.mobileFilters.show(resultCount)}
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
