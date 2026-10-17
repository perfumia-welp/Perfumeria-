import type { ImageAsset } from "./content"

/*
 * Catalogue types. The real product API should be mapped to these shapes in
 * an adapter (see services/catalog.ts); components never read raw API data.
 */

export type Gender = "women" | "men" | "unisex"

export type FragranceFamily = "floral" | "woody" | "amber"

export interface Product {
  id: string
  /** External identity; legacy mock/localStorage IDs remain unchanged. */
  businessId?: number
  productId?: number
  translations?: { name: BilingualText; description: BilingualText }
  description?: string
  category?: { id?: number; name: string; translations: BilingualText }
  gallery?: ImageAsset[]
  variations?: ProductVariation[]
  ingredients?: string
  editorialDescription?: BilingualText
  fragranceFamily?: string
  /** URL segment for the product page (/products/:slug). */
  slug: string
  name: string
  notes: string[]
  size?: string
  price: number
  compareAtPrice?: number
  currency: string
  family?: FragranceFamily
  gender?: Gender
  inStock: boolean
  /** Not shown yet: the Brand filter is enabled once real brand data exists. */
  brand?: string
  /** Editorial photograph (homepage cards). */
  image?: ImageAsset
  /** Transparent bottle cut-out on a neutral surface (catalogue, search, bag). */
  packshot: ImageAsset
  /**
   * "photo": the packshot is a styled photograph with its own background
   * (live company images, square or portrait), shown whole on the stage
   * rather than as a cut-out bottle. Absent means a cut-out.
   */
  packshotStyle?: "photo"
  /** Product-page copy. Optional: the API may not supply it for every product. */
  story?: ProductStory
  /**
   * Language each text is actually written in. Live products show the
   * company's English copy on Arabic pages until our own Arabic exists.
   */
  contentLocale?: { name: "en" | "ar"; description: "en" | "ar" }
  /** Where `size` came from: our supplemental data or the company's own text. */
  sizeSource?: "metadata" | "parsed"
  /**
   * The company lists options for this product (detail endpoint only).
   * It cannot go into the bag until one option per required choice is picked.
   */
  requiresOptionSelection?: boolean
  /** The picked options of a bag line; the line's `id` includes them. */
  selectedOptions?: SelectedOption[]
}

export interface SelectedOption {
  variationId: number
  optionId: number
  label: BilingualText
}

export interface BilingualText {
  en?: string | null
  ar?: string | null
}

/**
 * A company product choice (today: with box / without box). Not a size.
 * When `replacesPrice` is true the picked option's price is the product price.
 */
export interface ProductVariation {
  id: string
  name: BilingualText
  required: boolean
  replacesPrice: boolean
  options: {
    id: string
    name: BilingualText
    price?: number
    compareAtPrice?: number
    /** Added to the product price (options of non-main-price choices). */
    additionalPrice?: number
  }[]
}

export interface ProductIdentity {
  businessId: number
  productId: number
}

export interface ProductSelection extends ProductIdentity {
  options: { variationId: string; optionId: string }[]
}

/** Notes by stage of the fragrance's evaporation. */
export interface FragranceComposition {
  top: string[]
  heart: string[]
  base: string[]
}

/** Editorial product-page content. */
export interface ProductStory {
  description: string
  composition: FragranceComposition
  /** A few words for the fragrance's character or mood. */
  character: string[]
}

export type Availability = "in-stock" | "out-of-stock"

export type SortOption = "featured" | "price-asc" | "price-desc" | "name"

/** A Price filter band; its label is written per language from min/max. */
export interface PriceRange {
  id: string
  min?: number
  max?: number
}

/** Everything that narrows or orders the product list. Mirrors the URL query string. */
export interface ProductQuery {
  search?: string
  genders: Gender[]
  families: FragranceFamily[]
  availability?: Availability
  priceRange?: string
  brands: string[]
  sort: SortOption
  page: number
}

export interface ProductPage {
  items: Product[]
  total: number
  page: number
  pageCount: number
}

export interface FilterOption<Value extends string = string> {
  value: Value
  label: string
  count: number
}

/** Filter groups and their options, derived from the catalogue (or returned by the API). */
export interface ProductFacets {
  genders: FilterOption<Gender>[]
  families: FilterOption<FragranceFamily>[]
  availability: FilterOption<Availability>[]
  priceRanges: FilterOption[]
  brands: FilterOption[]
}

export interface SearchResult {
  query: string
  items: Product[]
  total: number
}
