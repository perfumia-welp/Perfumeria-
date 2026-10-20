import type { Product } from "../../types/catalog.ts"
import {
  normalizeProduct,
  type AdapterConfig,
  type GalleryRow,
  type ProductMetadata,
  type WelpProduct,
} from "./adapter.ts"

export type ProductSource = "mock" | "live"
export function parseProductSource(value?: string): ProductSource {
  if (!value || value === "mock") return "mock"
  if (value === "live") return "live"
  throw new Error("Unsupported catalogue source")
}

type Locale = "en" | "ar"

/** The whole company catalogue plus our supplemental rows, as fetched. */
export interface CatalogSnapshot {
  products: WelpProduct[]
  categoryNames: Record<number, string>
  metadata: ProductMetadata[]
  gallery: GalleryRow[]
}

export interface CatalogState {
  /** Every product is loaded (search, filters, sort and all pages work). */
  complete: boolean
  /** Total products in the company catalogue (known from the first page). */
  total: number
  /** The background load of the full catalogue failed; retry with loadAll(). */
  failed: boolean
}

export interface ProductRepository {
  /** Resolves once something can be shown: the first page, or a cached catalogue. */
  load(): Promise<void>
  /** Loads (or reloads) the full catalogue. */
  loadAll(): Promise<void>
  state(): CatalogState
  getCatalog(locale: Locale): Product[]
  /** Fetches one product's detail once; later calls reuse it. */
  loadDetail(productId: number): Promise<void>
  getDetail(productId: number, locale: Locale): Product | undefined
  /** Live products left out because their company data was malformed. */
  readonly skipped: number
}

/** Newest first: the company's own /products order (id descending). */
const newestFirst = (a: WelpProduct, b: WelpProduct) => b.id - a.id

/**
 * All joins happen here. Live loading is progressive: the first company page
 * and our Supabase rows render the site quickly; the full catalogue follows
 * in the background in the same order, so nothing reshuffles. Failed loads
 * are errors, never a mock fallback.
 */
export function createProductRepository(options: {
  source: ProductSource
  mock: (locale: Locale) => Product[]
  config: AdapterConfig
  firstPage: () => Promise<{ products: WelpProduct[]; total: number }>
  company: () => Promise<{ products: WelpProduct[]; categoryNames: Record<number, string> }>
  supplemental: (businessId: number) => Promise<{ metadata: ProductMetadata[]; gallery: GalleryRow[] }>
  detail: (productId: number) => Promise<WelpProduct>
  /**
   * Same-session reuse of the last full catalogue (short-lived). A cache
   * that is not `fresh` is shown at once and refreshed in the background.
   */
  cache?: {
    read(): { snapshot: CatalogSnapshot; fresh: boolean } | undefined
    write(snapshot: CatalogSnapshot): void
  }
  onChange?: () => void
}): ProductRepository {
  let loaded: Record<Locale, Product[]> | undefined
  let state: CatalogState = { complete: options.source === "mock", total: 0, failed: false }
  let skipped = 0
  /** Our Supabase rows for the load in progress, shared by both company requests. */
  let supplemental: Promise<{ metadata: ProductMetadata[]; gallery: GalleryRow[] }> | undefined
  let join:
    | { config: AdapterConfig; metadata: Map<number, ProductMetadata>; gallery: GalleryRow[] }
    | undefined
  const details = new Map<number, Record<Locale, Product>>()
  const pending = new Map<number, Promise<void>>()
  let full: Promise<void> | undefined

  const setJoin = (
    extra: { metadata: ProductMetadata[]; gallery: GalleryRow[] },
    categoryNames: Record<number, string> = join?.config.categoryNames ?? {},
  ) => {
    const metadata = new Map<number, ProductMetadata>()
    for (const row of extra.metadata)
      if (row.business_id === options.config.businessId) metadata.set(row.product_id, row)
    join = { config: { ...options.config, categoryNames }, metadata, gallery: extra.gallery }
  }
  const normalizeBoth = (row: WelpProduct) => {
    if (!join) throw new Error("Catalogue is unavailable")
    const { config, metadata, gallery } = join
    const meta = metadata.get(row?.id)
    return {
      en: normalizeProduct(row, config, "en", meta, gallery),
      ar: normalizeProduct(row, config, "ar", meta, gallery),
    }
  }
  /** Normalizes a company list; malformed products are left out and counted. */
  const build = (rows: WelpProduct[]) => {
    const ids = rows.map((row) => row?.id)
    if (new Set(ids).size !== ids.length) throw new Error("Duplicate product identity")
    const en: Product[] = []
    const ar: Product[] = []
    let bad = 0
    for (const row of [...rows].sort(newestFirst)) {
      try {
        const both = normalizeBoth(row)
        en.push(both.en)
        ar.push(both.ar)
      } catch {
        bad++
      }
    }
    if (!en.length) throw new Error("Catalogue is empty")
    return { catalog: { en, ar }, bad }
  }
  const useSnapshot = (snapshot: CatalogSnapshot) => {
    setJoin(snapshot, snapshot.categoryNames)
    const { catalog, bad } = build(snapshot.products)
    loaded = catalog
    skipped = bad
    state = { complete: true, total: catalog.en.length + bad, failed: false }
    options.onChange?.()
  }

  const repository: ProductRepository = {
    get skipped() {
      return skipped
    },
    state: () => state,
    async load() {
      if (options.source === "mock") return
      const cached = options.cache?.read()
      if (cached) {
        try {
          useSnapshot(cached.snapshot)
          // Show the cached catalogue at once, then refresh prices/availability.
          if (!cached.fresh) void repository.loadAll().catch(() => {})
          return
        } catch {
          // An unusable cache is ignored.
        }
      }
      loaded = undefined
      // Both company requests start now; the small first page usually wins.
      supplemental = options.supplemental(options.config.businessId)
      const everything = repository.loadAll()
      everything.catch(() => {})
      let first: { products: WelpProduct[]; total: number }
      let extra: { metadata: ProductMetadata[]; gallery: GalleryRow[] }
      try {
        ;[first, extra] = await Promise.all([options.firstPage(), supplemental])
      } catch (error) {
        // A failed first page is fine if the full catalogue arrives instead.
        await everything.catch(() => {
          throw error
        })
        return
      }
      if (state.complete) return
      setJoin(extra)
      const { catalog, bad } = build(first.products)
      loaded = catalog
      skipped = bad
      state = { complete: false, total: first.total, failed: state.failed }
    },
    loadAll() {
      if (options.source === "mock") return Promise.resolve()
      full ??= (async () => {
        try {
          const [company, extra] = await Promise.all([
            options.company(),
            supplemental ?? options.supplemental(options.config.businessId),
          ])
          const snapshot = { ...company, ...extra }
          useSnapshot(snapshot)
          options.cache?.write(snapshot)
        } catch (error) {
          if (!state.complete) {
            state = { ...state, failed: true }
            options.onChange?.()
          }
          throw error
        } finally {
          full = undefined
          supplemental = undefined
        }
      })()
      return full
    },
    getCatalog(locale) {
      if (options.source === "mock") return options.mock(locale)
      if (!loaded) throw new Error("Catalogue is unavailable")
      return loaded[locale]
    },
    loadDetail(productId) {
      if (options.source === "mock" || details.has(productId)) return Promise.resolve()
      let request = pending.get(productId)
      if (!request) {
        request = options
          .detail(productId)
          .then((row) => {
            details.set(productId, normalizeBoth(row))
            options.onChange?.()
          })
          .finally(() => pending.delete(productId))
        pending.set(productId, request)
      }
      return request
    },
    getDetail(productId, locale) {
      return details.get(productId)?.[locale]
    },
  }
  return repository
}
