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
  /** Single mode: products the leading All option lists (shown beside it). */
  allCount?: number
  /** Show the group even when it has fewer than two options. */
  alwaysShow?: boolean
}

/**
 * The filter groups shown on the Products page, shared by the desktop
 * sidebar and the mobile filter sheet, in display order: Gender, Price, then
 * any other group the catalogue can fill. Data-driven: an option no product
 * matches is left out (unless it is selected), and a group that can no longer
 * narrow the list (fewer than two options) is hidden. The Gender group itself
 * always shows, but like every group it hides an option with no products:
 * Unisex stays out of the UI while its count is 0 (unless the URL selects
 * it) and appears by itself once products are marked unisex. So a live
 * catalogue without fragrance families shows no Family filter, and it appears
 * by itself once our Supabase metadata supplies families. Brand needs two
 * brands.
 */
export function buildFilterGroups(
  facets: ProductFacets,
  query: ProductQuery,
  update: (changes: Partial<ProductQuery>) => void,
  labels: Messages["products"]["groups"],
): FilterGroup[] {
  const groups: FilterGroup[] = [
    // One gender view at a time (Women and Men each include unisex).
    {
      id: "gender",
      label: labels.gender,
      mode: "single",
      options: facets.genders,
      selected: query.genders,
      allCount: facets.total,
      alwaysShow: true,
      onChange: ([value]) => update({ genders: value ? [value as Gender] : [] }),
    },
    {
      id: "price",
      label: labels.price,
      mode: "single",
      options: facets.priceRanges,
      selected: query.priceRange ? [query.priceRange] : [],
      onChange: ([value]) => update({ priceRange: value }),
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
  ]

  if (facets.brands.length > 1) {
    groups.push({
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
    .filter(
      (group) =>
        group.alwaysShow ||
        group.options.length > 1 ||
        group.selected.length > 0,
    )
}
