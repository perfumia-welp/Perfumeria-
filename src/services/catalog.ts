import { createProductRepository, parseProductSource, type CatalogSnapshot, type ProductSource } from "./products/repository"
import { applySelection, localizedText, OPTION_SEPARATOR, optionPriceRange } from "./products/adapter"
import { loadSupplemental } from "./products/supplemental"
import { fetchWelpCatalog, fetchWelpFirstPage, fetchWelpProduct } from "./products/welp"
import { LIVE_CATALOG } from "@/config/catalog"
import { catalog as mockCatalog, featuredProductIds, priceRanges as mockPriceRanges } from "@/data/catalog"
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locales"
import { getMessages, hasMessages } from "@/i18n/messages"
import { formatPrice } from "@/lib/formatPrice"
import type {
  Availability,
  FilterOption,
  FragranceFamily,
  Gender,
  PriceRange,
  Product,
  ProductFacets,
  ProductPage,
  ProductQuery,
  SearchResult,
  SortOption,
} from "@/types/catalog"

/*
 * Catalogue queries over the normalized repository. Search, filters, sorting
 * and paging stay local; no unsupported company filters are assumed.
 * The URL query string is the source of truth for every ProductQuery; its
 * values (gender=women, sort=price-desc) are the same in every language.
 *
 * Every function takes the visitor's locale. Commercial data (price, stock,
 * size, ids, names) is shared; descriptive fields (notes, product stories,
 * image text, filter labels) come in that language, as a localised API
 * response would.
 */

export const PAGE_SIZE = 12

const GENDERS: Gender[] = ["women", "men", "unisex"]
const FAMILIES: FragranceFamily[] = ["floral", "woody", "amber"]
const AVAILABILITY: Availability[] = ["in-stock", "out-of-stock"]
const SORTS: SortOption[] = ["featured", "price-asc", "price-desc", "name"]

const localized = new Map<Locale, Product[]>()

/** The whole catalogue in one language. */
function getMockCatalog(locale: Locale = DEFAULT_LOCALE): Product[] {
  const cached = localized.get(locale)
  if (cached) return cached
  const text = getMessages(locale).catalog
  const products = mockCatalog.map((product) => ({
    ...product,
    notes: product.notes.map((note) => text.notes[note] ?? note),
    story: text.stories[product.id],
    packshot: { ...product.packshot, alt: text.packshotAlt(product.name) },
    image: product.image && {
      ...product.image,
      alt: text.editorialAlt(product.name),
    },
  }))
  // A locale still loading falls back to English; only cache the real thing.
  if (hasMessages(locale)) localized.set(locale, products)
  return products
}

/*
 * Catalogue source. Production builds (`npm run build`) use the live company
 * catalogue; the dev server and `npm run build:mock` (Vite mode "mock", used
 * by the regression audits) use the mock catalogue. VITE_PRODUCT_SOURCE
 * (mock | live), when set, overrides both. On the Vite dev server only,
 * `?catalog=live` / `?catalog=mock` switches the source for the browser tab
 * (kept in sessionStorage so links keep it), and the shared review address
 * below (the ngrok tunnel to the dev server) defaults to live while
 * localhost stays mock. There is no automatic fallback:
 * a failed live load shows the error with Retry, never mock products.
 */
const DEV_CATALOG_KEY = "perfumeria:dev-catalog"
/** Dev-server hostnames that show the live catalogue by default (review tunnel). */
const LIVE_REVIEW_HOSTS = ["gymnastic-unrusticated-elijah.ngrok-free.dev"]
function devCatalogSource(fallback: ProductSource): ProductSource {
  try {
    const requested = new URLSearchParams(window.location.search).get("catalog")
    if (requested === "live" || requested === "mock")
      sessionStorage.setItem(DEV_CATALOG_KEY, requested)
    const stored = sessionStorage.getItem(DEV_CATALOG_KEY)
    return stored === "live" || stored === "mock" ? stored : fallback
  } catch {
    return fallback
  }
}
const configuredSource = parseProductSource(
  import.meta.env.VITE_PRODUCT_SOURCE ||
    (import.meta.env.PROD && import.meta.env.MODE !== "mock" ? "live" : "mock"),
)
export const productSource: ProductSource = import.meta.env.DEV
  ? devCatalogSource(
      !import.meta.env.VITE_PRODUCT_SOURCE &&
        LIVE_REVIEW_HOSTS.includes(window.location.hostname)
        ? "live"
        : configuredSource,
    )
  : configuredSource

/*
 * Same-tab reuse of the full live catalogue, so moving around the site or
 * reloading does not wait ~3 s again. Short-lived (10 minutes) and always
 * refreshed in the background, so prices and availability stay current.
 */
const CATALOG_CACHE_KEY = "perfumeria:live-catalog:v1"
const CATALOG_CACHE_MS = 10 * 60 * 1000
const sessionCache = {
  read(): CatalogSnapshot | undefined {
    try {
      const saved = JSON.parse(sessionStorage.getItem(CATALOG_CACHE_KEY) ?? "null")
      if (
        saved?.businessId !== LIVE_CATALOG.businessId ||
        typeof saved.savedAt !== "number" ||
        Date.now() - saved.savedAt > CATALOG_CACHE_MS
      )
        return undefined
      return saved.snapshot as CatalogSnapshot
    } catch {
      return undefined
    }
  },
  write(snapshot: CatalogSnapshot) {
    try {
      sessionStorage.setItem(
        CATALOG_CACHE_KEY,
        JSON.stringify({ savedAt: Date.now(), businessId: LIVE_CATALOG.businessId, snapshot }),
      )
    } catch {
      // Storage full or blocked: the next visit simply fetches again.
    }
  },
}

/* Catalogue changes (full catalogue arrived, refresh, product detail) for React. */
const listeners = new Set<() => void>()
let catalogVersion = 0
export function subscribeCatalog(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export const getCatalogVersion = () => catalogVersion

const repository = createProductRepository({
  source: productSource,
  mock: getMockCatalog,
  config: {
    businessId: LIVE_CATALOG.businessId,
    currency: LIVE_CATALOG.currency,
    mediaOrigin: LIVE_CATALOG.mediaOrigin,
    productTypeGender: LIVE_CATALOG.productTypeGender,
  },
  firstPage: fetchWelpFirstPage,
  company: fetchWelpCatalog,
  supplemental: loadSupplemental,
  detail: fetchWelpProduct,
  cache: sessionCache,
  onChange: () => {
    catalogVersion++
    listeners.forEach((listener) => listener())
  },
})
let loading: Promise<void> | undefined
export function initializeCatalog() {
  loading ??= repository.load().catch((error) => { loading = undefined; throw error })
  return loading
}
export function getCatalog(locale: Locale = DEFAULT_LOCALE): Product[] {
  return repository.getCatalog(locale)
}
/** Whether every product is loaded yet (live loads the first page first). */
export const getCatalogState = () => repository.state()
/** Retries the full live catalogue after a failed background load. */
export const retryFullCatalog = () => repository.loadAll()
/** Live products left out because their company data was malformed. */
export const getSkippedProductCount = () => repository.skipped

/** Price filter bands in the catalogue's own currency. */
const priceRanges = productSource === "live" ? LIVE_CATALOG.priceRanges : mockPriceRanges

/** The company product id in a live product URL (`product-14092`). */
export function productIdFromSlug(slug: string) {
  if (productSource !== "live") return undefined
  const match = /^product-([1-9]\d{0,15})$/.exec(slug)
  const id = match ? Number(match[1]) : NaN
  return Number.isSafeInteger(id) ? id : undefined
}
/** Fetches a live product's detail (options, freshest price) once per visit. */
export function loadProductDetail(productId: number) {
  return repository.loadDetail(productId)
}
export function getProductDetail(productId: number, locale: Locale) {
  return repository.getDetail(productId, locale)
}
/** The product for a product page: its live detail when loaded, else the listing. */
export function findProductForPage(slug: string, locale: Locale = DEFAULT_LOCALE) {
  const id = productIdFromSlug(slug)
  return (id ? getProductDetail(id, locale) : undefined) ?? findProductBySlug(slug, locale)
}
/** Lowest and highest price across a product's required box / no-box choice. */
export const getOptionPriceRange = optionPriceRange

/** Text in the page language, falling back to the other language. */
export const localizeText = localizedText

/**
 * True when the product needs a company option (box / no box) picked on its
 * product page before it can go in the bag: cards offer "Choose Options".
 */
export function needsOptionChoice(product: Product) {
  return product.requiresOptionSelection === true && !product.selectedOptions
}

/** Navigation state that makes the product page point to its options. */
export const CHOOSE_OPTION_STATE = { chooseOption: true }

/** A bag line for the product with these options picked (throws if incomplete). */
export function selectProductOptions(
  product: Product,
  picks: Record<string, string>,
  locale: Locale,
) {
  return applySelection(product, picks, locale)
}

export function getSortOptions(locale: Locale): FilterOption<SortOption>[] {
  const labels = getMessages(locale).catalog.sort
  return SORTS.map((value) => ({ value, label: labels[value], count: 0 }))
}

const pick = <Value extends string>(values: string[], allowed: Value[]) =>
  values.filter((value): value is Value => allowed.includes(value as Value))

export function parseProductQuery(params: URLSearchParams): ProductQuery {
  const sort = params.get("sort")
  const availability = params.get("availability")
  const page = Number(params.get("page"))
  const priceRange = params.get("price")

  return {
    search: params.get("q")?.trim() || undefined,
    genders: pick(params.getAll("gender"), GENDERS),
    families: pick(params.getAll("family"), FAMILIES),
    availability: AVAILABILITY.includes(availability as Availability)
      ? availability as Availability
      : undefined,
    priceRange: priceRanges.some((range) => range.id === priceRange)
      ? (priceRange ?? undefined)
      : undefined,
    brands: params.getAll("brand"),
    sort: SORTS.includes(sort as SortOption) ? sort as SortOption : "featured",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

/** Serialises a query back to URL parameters, omitting defaults. */
export function toSearchParams(query: ProductQuery) {
  const params = new URLSearchParams()
  if (query.search) params.set("q", query.search)
  query.genders.forEach((gender) => params.append("gender", gender))
  query.families.forEach((family) => params.append("family", family))
  if (query.availability) params.set("availability", query.availability)
  if (query.priceRange) params.set("price", query.priceRange)
  query.brands.forEach((brand) => params.append("brand", brand))
  if (query.sort !== "featured") params.set("sort", query.sort)
  if (query.page > 1) params.set("page", String(query.page))
  return params
}

/**
 * Lower-cases and folds spelling variants so search forgives accents
 * ("lumiere"), Arabic diacritics and letter forms (أ/إ/آ → ا, ى → ي,
 * ة → ه), and the article ("العود" finds "عود").
 */
export function normalizeSearchText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/(^|\s)ال(?=\S)/g, "$1")
    .trim()
}

/**
 * Product names stay in Latin letters, so they are searchable from either
 * language. Notes and families are searchable in English and in the
 * visitor's language.
 */
function searchableText(product: Product, locale: Locale) {
  const locales = new Set<Locale>([DEFAULT_LOCALE, locale])
  const parts = [product.name, product.brand ?? "", product.translations?.name.en ?? "", product.translations?.name.ar ?? "", product.category?.translations.en ?? "", product.category?.translations.ar ?? ""]
  locales.forEach((language) => {
    const text = getMessages(language).catalog
    parts.push(
      ...product.notes.map((note) => text.notes[note] ?? note),
      product.family ? text.families[product.family] : product.fragranceFamily ?? "",
    )
  })
  return normalizeSearchText(parts.join(" "))
}

export function matchesSearch(product: Product, term: string, locale: Locale) {
  const needle = normalizeSearchText(term)
  if (!needle) return false
  return searchableText(product, locale).includes(needle)
}

function inPriceRange(product: Product, rangeId?: string) {
  const range = priceRanges.find((candidate) => candidate.id === rangeId)
  if (!range) return true
  const aboveMin = range.min === undefined || product.price >= range.min
  const belowMax = range.max === undefined || product.price < range.max
  return aboveMin && belowMax
}

const sorters: Record<SortOption, (a: Product, b: Product) => number> = {
  featured: () => 0,
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  name: (a, b) => a.name.localeCompare(b.name),
}

/*
 * Filtering runs on the shared records (catalog), so results and order are
 * identical in every language; only the returned products are localised.
 */
export function queryProducts(
  query: ProductQuery,
  locale: Locale,
  pageSize = PAGE_SIZE,
): ProductPage {
  const matches = getCatalog(locale)
    .filter(
      (product) =>
        !query.search || matchesSearch(product, query.search, locale),
    )
    .filter(
      (product) =>
        !query.genders.length || (product.gender !== undefined && query.genders.includes(product.gender)),
    )
    .filter(
      (product) =>
        !query.families.length || (product.family !== undefined && query.families.includes(product.family)),
    )
    .filter(
      (product) =>
        !query.availability ||
        (query.availability === "in-stock") === product.inStock,
    )
    .filter((product) => inPriceRange(product, query.priceRange))
    .filter(
      (product) =>
        !query.brands.length ||
        (product.brand !== undefined && query.brands.includes(product.brand)),
    )
    .sort(sorters[query.sort])

  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize))
  const page = Math.min(query.page, pageCount)
  return {
    items: matches.slice((page - 1) * pageSize, page * pageSize),
    total: matches.length,
    page,
    pageCount,
  }
}

const countBy = <Value extends string,>(
  values: Value[],
  labels: Record<Value, string>,
  key: (product: Product) => Value | undefined,
): FilterOption<Value>[] =>
  values.map((value) => ({
    value,
    label: labels[value],
    count: getCatalog().filter((product) => key(product) === value).length,
  }))

/** Filter groups derived from the catalogue. Brand stays empty until products carry brand data. */
export function getProductFacets(locale: Locale): ProductFacets {
  const text = getMessages(locale).catalog
  const currency =
    getCatalog(locale)[0]?.currency ??
    (productSource === "live" ? LIVE_CATALOG.currency : "USD")
  const price = (amount: number) => formatPrice(amount, currency, locale)
  const priceLabel = ({ min, max }: PriceRange) => {
    if (min === undefined && max !== undefined)
      return text.priceRanges.under(price(max))
    if (max === undefined && min !== undefined)
      return text.priceRanges.over(price(min))
    return text.priceRanges.between(price(min ?? 0), price(max ?? 0))
  }
  const brands = [
    ...new Set(
      getCatalog(locale).flatMap((product) => (product.brand ? [product.brand] : [])),
    ),
  ]
  return {
    genders: countBy(GENDERS, text.genders, (product) => product.gender),
    families: countBy(FAMILIES, text.families, (product) => product.family),
    availability: countBy(AVAILABILITY, text.availability, (product) =>
      product.inStock ? "in-stock" : "out-of-stock",
    ),
    priceRanges: priceRanges.map((range) => ({
      value: range.id,
      label: priceLabel(range),
      count: getCatalog().filter((product) => inPriceRange(product, range.id))
        .length,
    })),
    brands:
      brands.length > 1
        ? brands.map((brand) => ({
            value: brand,
            label: brand,
            count: getCatalog().filter((product) => product.brand === brand).length,
          }))
        : [],
  }
}

/** Live search: genuine matches only, never padded with unrelated products. */
export function searchProducts(
  term: string,
  locale: Locale,
  limit = 5,
): SearchResult {
  const items = getCatalog(locale).filter((product) =>
    matchesSearch(product, term, locale),
  )
  return {
    query: term.trim(),
    items: items.slice(0, limit),
    total: items.length,
  }
}

export function findProduct(
  id: string,
  locale: Locale = DEFAULT_LOCALE,
): Product | undefined {
  const [productId, ...optionIds] = id.split(OPTION_SEPARATOR)
  const product = getCatalog(locale).find((item) => item.id === productId)
  if (!product || !optionIds.length) return product
  // A bag line with options: rebuild it in this language from the cached detail.
  const detail =
    product.productId !== undefined ? getProductDetail(product.productId, locale) : undefined
  if (!detail?.variations) return undefined
  const picks: Record<string, string> = {}
  for (const optionId of optionIds) {
    const variation = detail.variations.find((item) =>
      item.options.some((option) => option.id === optionId),
    )
    if (!variation) return undefined
    picks[variation.id] = optionId
  }
  try {
    return applySelection(detail, picks, locale)
  } catch {
    return undefined
  }
}

export function findProductBySlug(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
) {
  return getCatalog(locale).find((product) => product.slug === slug)
}

/** Homepage "Offers for This Season", in catalogue order of the selection. */
export function getFeaturedProducts(locale: Locale) {
  if (productSource === "live") return getCatalog(locale).filter((product) => product.compareAtPrice !== undefined).slice(0, 4)
  return featuredProductIds.flatMap((id) => {
    const product = findProduct(id, locale)
    return product ? [product] : []
  })
}

/**
 * The transparent bottle Hero C stages: mock packshots are cut-outs already;
 * a live product needs its own `cutout`, never the styled company photo.
 */
export function getHeroArt(product: Product) {
  if (product.cutout) return product.cutout
  return product.packshotStyle === "photo" ? undefined : product.packshot
}

/** A hero pick, only when it is in the catalogue and has a cut-out bottle. */
export function getHeroProduct(id: string, locale: Locale) {
  const product = findProduct(id, locale)
  return product && getHeroArt(product) ? product : undefined
}

/**
 * Other fragrances to suggest on a product page: the same family first, then
 * the rest. Products without a family (the live catalogue today) suggest the
 * next products of the same gender in catalogue order, so every product page
 * links on to different products and each product is reachable by links.
 */
export function getRelatedProducts(
  product: Product,
  locale: Locale,
  limit = 4,
) {
  if (!product.family) {
    const catalog = getCatalog(locale)
    const index = catalog.findIndex((candidate) => candidate.id === product.id)
    const following = [...catalog.slice(index + 1), ...catalog.slice(0, Math.max(index, 0))]
      .filter((candidate) => candidate.id !== product.id)
    const sameGender = following.filter(
      (candidate) => product.gender !== undefined && candidate.gender === product.gender,
    )
    const rest = following.filter((candidate) => !sameGender.includes(candidate))
    return [...sameGender, ...rest].slice(0, limit)
  }
  const others = getCatalog(locale).filter(
    (candidate) => candidate.id !== product.id,
  )
  const sameFamily = others.filter(
    (candidate) => candidate.family === product.family,
  )
  const rest = others.filter((candidate) => candidate.family !== product.family)
  return [...sameFamily, ...rest].slice(0, limit)
}

/**
 * Gender categories the catalogue really has: the live catalogue only has
 * the company's men and women product types (no unisex category), so no
 * link or landing page offers one.
 */
export const catalogGenders: Gender[] =
  productSource === "live"
    ? [...new Set(Object.values(LIVE_CATALOG.productTypeGender))]
    : GENDERS

/*
 * Several live products share a name (and size). Their page titles add the
 * company product number so every title stays unique. Computed once per
 * catalogue change; empty until the full catalogue has loaded.
 */
let sharedNames: { version: number; ids: Set<string> } | undefined
const nameKey = (product: Product) =>
  `${(product.translations?.name.en ?? product.name).trim().toLowerCase().replace(/s+/g, " ")}|${product.size ?? ""}`
/** The product number to show in the title when another product has the same name and size. */
export function getTitleReference(product: Product): string | undefined {
  if (productSource !== "live") return undefined
  if (sharedNames?.version !== catalogVersion) {
    const groups = new Map<string, string[]>()
    for (const item of getCatalog()) {
      const key = nameKey(item)
      groups.set(key, [...(groups.get(key) ?? []), item.id])
    }
    sharedNames = {
      version: catalogVersion,
      ids: new Set([...groups.values()].filter((ids) => ids.length > 1).flat()),
    }
  }
  return sharedNames.ids.has(product.id) ? product.id : undefined
}
