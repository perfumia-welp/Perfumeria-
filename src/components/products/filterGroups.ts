import type { Messages } from "@/i18n/messages"
import type {
  Availability,
  FilterOption,
  FragranceFamily,
  Gender,
  ProductFacets,
  ProductQuery,
} from "@/types/catalog"

export interface FilterGroup {
  id: string
  label: string
  mode: "multiple" | "single"
  options: FilterOption[]
  selected: string[]
  onChange: (values: string[]) => void
}

/**
 * The filter groups shown on the Products page, shared by the desktop
 * dropdowns and the mobile filter sheet. Data-driven: an option no product
 * matches is left out (unless it is selected), and a group that can no longer
 * narrow the list (fewer than two options) is hidden. So a live catalogue
 * without fragrance families shows no Family filter, and it appears by itself
 * once our Supabase metadata supplies families. Brand needs two brands.
 */
export function buildFilterGroups(
  facets: ProductFacets,
  query: ProductQuery,
  update: (changes: Partial<ProductQuery>) => void,
  labels: Messages["products"]["groups"],
): FilterGroup[] {
  const groups: FilterGroup[] = [
    {
      id: "gender",
      label: labels.gender,
      mode: "multiple",
      options: facets.genders,
      selected: query.genders,
      onChange: (values) => update({ genders: values as Gender[] }),
    },
    {
      id: "family",
      label: labels.family,
      mode: "multiple",
      options: facets.families,
      selected: query.families,
      onChange: (values) => update({ families: values as FragranceFamily[] }),
    },
    {
      id: "availability",
      label: labels.availability,
      mode: "single",
      options: facets.availability,
      selected: query.availability ? [query.availability] : [],
      onChange: ([value]) =>
        update({ availability: value as Availability | undefined }),
    },
    {
      id: "price",
      label: labels.price,
      mode: "single",
      options: facets.priceRanges,
      selected: query.priceRange ? [query.priceRange] : [],
      onChange: ([value]) => update({ priceRange: value }),
    },
  ]

  if (facets.brands.length > 1) {
    groups.unshift({
      id: "brand",
      label: labels.brand,
      mode: "multiple",
      options: facets.brands,
      selected: query.brands,
      onChange: (values) => update({ brands: values }),
    })
  }

  return groups
    .map((group) => ({
      ...group,
      options: group.options.filter(
        (option) => option.count > 0 || group.selected.includes(option.value),
      ),
    }))
    .filter((group) => group.options.length > 1 || group.selected.length > 0)
}
