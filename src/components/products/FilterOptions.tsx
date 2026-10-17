import { useId } from "react"
import type { FilterOption } from "@/types/catalog"
import "./FilterOptions.css"

interface FilterOptionsProps {
  legend: string
  options: FilterOption[]
  selected: string[]
  /** "multiple" renders checkboxes; "single" renders radios. */
  mode: "multiple" | "single"
  /** For single mode: label of a leading option that clears the selection. */
  allLabel?: string
  onChange: (values: string[]) => void
  /** Show how many products match each option. */
  showCounts?: boolean
  /** Keep the legend for screen readers only (when a visible label already names the group). */
  hideLegend?: boolean
}

/** One filter group as a native fieldset of checkboxes or radios. */
export default function FilterOptions({
  legend,
  options,
  selected,
  mode,
  onChange,
  showCounts = true,
  allLabel,
  hideLegend = false,
}: FilterOptionsProps) {
  const name = useId()

  const toggle = (value: string, checked: boolean) => {
    if (mode === "single") onChange(value ? [value] : [])
    else
      onChange(
        checked
          ? [...selected, value]
          : selected.filter((current) => current !== value),
      )
  }

  const choices =
    mode === "single" && allLabel
      ? [{ value: "", label: allLabel, count: -1 }, ...options]
      : options

  return (
    <fieldset className="filter-options">
      <legend
        className={hideLegend ? "visually-hidden" : "filter-options__legend"}
      >
        {legend}
      </legend>
      {choices.map((option) => {
        const checked =
          option.value === ""
            ? selected.length === 0
            : selected.includes(option.value)
        return (
          <label key={option.value || "all"} className="filter-options__item">
            <input
              type={mode === "single" ? "radio" : "checkbox"}
              name={name}
              value={option.value}
              checked={checked}
              onChange={(event) => toggle(option.value, event.target.checked)}
            />
            <span>{option.label}</span>
            {showCounts && option.count >= 0 && (
              <span className="filter-options__count">{option.count}</span>
            )}
          </label>
        )
      })}
    </fieldset>
  )
}
