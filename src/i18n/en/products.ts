/* The catalogue page: intro, filters, sort, empty state and paging. */
export default {
  intro: {
    eyebrow: "The collection",
    title: "Our Fragrances",
    lead: "Discover compositions selected for character, mood and memory.",
  },
  /** Collection landing pages (/men-perfumes, /women-perfumes): facts only. */
  collections: {
    men: {
      eyebrow: "The collection",
      title: "Men’s Perfumes",
      lead: "Every men’s fragrance in our collection, with prices in Egyptian pounds.",
    },
    women: {
      eyebrow: "The collection",
      title: "Women’s Perfumes",
      lead: "Every women’s fragrance in our collection, with prices in Egyptian pounds.",
    },
    /** Link to the other collection, under the intro. */
    other: { men: "Shop Women’s Perfumes", women: "Shop Men’s Perfumes" },
  },
  resultsFor: (term: string) => `Results for “${term}”`,
  clearSearch: "Clear search",
  toolbar: {
    label: "Filter and sort",
    filterBy: "Filter by",
    /** Screen-reader wording after a group's selected count. */
    selected: "selected",
    all: "All",
    clearAll: "Clear all",
    filter: "Filter",
    sortBy: "Sort by",
  },
  groups: {
    gender: "Gender",
    family: "Fragrance Family",
    availability: "Availability",
    price: "Price",
    brand: "Brand",
  },
  mobileFilters: {
    label: "Filter fragrances",
    title: "Filter",
    show: (count: number) =>
      `Show ${count} ${count === 1 ? "Fragrance" : "Fragrances"}`,
  },
  empty: {
    title: "No fragrances match your selection.",
    text: "Try removing a filter or searching for another note.",
    action: "Clear filters",
  },
  pagination: {
    label: "Product pages",
    previous: "Previous",
    next: "Next",
    page: (page: number) => `Page ${page}`,
    /** Compact phone pagination, also the status read for every layout. */
    pageOf: (page: number, count: number) => `Page ${page} of ${count}`,
  },
  /** While the full live catalogue is still arriving after the first page. */
  loading: "Loading the collection…",
  loadError: "The full collection could not be loaded.",
  retry: "Try again",
}
