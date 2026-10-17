import { productStories } from "@/data/productStories"
import type { ProductStory } from "@/types/catalog"

/*
 * Words for catalogue data. Prices, stock, sizes and ids are shared between
 * languages (data/catalog.ts); only descriptive text is localised here and
 * applied by the catalogue adapter (services/catalog.ts).
 */
export default {
  families: {
    floral: "Floral",
    woody: "Woody",
    amber: "Amber",
  },
  genders: {
    women: "Women",
    men: "Men",
    unisex: "Unisex",
  },
  availability: {
    "in-stock": "In Stock",
    "out-of-stock": "Out of Stock",
  },
  /** Receive already-formatted prices. */
  priceRanges: {
    under: (max: string) => `Under ${max}`,
    between: (min: string, max: string) => `${min} – ${max}`,
    over: (min: string) => `Over ${min}`,
  },
  sort: {
    featured: "Featured",
    "price-asc": "Price: Low to High",
    "price-desc": "Price: High to Low",
    name: "Name: A–Z",
  },
  popularSearches: ["Oud", "Rose", "Musk", "Vanilla", "Floral"],
  /** Note names in this language, keyed by the catalogue's English note. */
  notes: {} as Record<string, string>,
  /** Product-page stories, keyed by product id. */
  stories: productStories as Record<string, ProductStory>,
  packshotAlt: (name: string) => `${name} perfume bottle`,
  editorialAlt: (name: string) => `${name} perfume`,
}
