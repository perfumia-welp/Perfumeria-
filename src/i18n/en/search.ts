/* The search overlay. */
export default {
  label: "Search Perfumeria",
  close: "Close search",
  inputLabel: "Search fragrances and notes",
  placeholder: "Search fragrances, notes…",
  submit: "Show all results",
  popular: "Popular Searches",
  results: "Results",
  found: (count: number) =>
    `${count} ${count === 1 ? "fragrance" : "fragrances"} found`,
  none: "No fragrances found",
  /** Live search waits for the full catalogue (a few seconds on a first visit). */
  loading: "Loading the collection…",
  viewAll: (term: string) => `View all results for “${term}”`,
  empty: {
    title: "No fragrances found.",
    text: "Try another fragrance name, note or family.",
  },
}
