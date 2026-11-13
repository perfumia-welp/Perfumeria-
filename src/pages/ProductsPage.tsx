import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react"
import { useBag } from "@/cart/bagContext"
import { useCardDesign } from "@/components/product/cardDesign"
import { designPreview } from "@/config/designPreview"
import ProductCard from "@/components/product/ProductCard"
import LoadMore from "@/components/products/LoadMore"
import ProductGridSkeleton, {
  ProductSkeleton,
  SKELETON_APPEAR_MS,
} from "@/components/products/ProductGridSkeleton"
import FilterSidebar from "@/components/products/FilterSidebar"
import ProductToolbar from "@/components/products/ProductToolbar"
import { buildFilterGroups } from "@/components/products/filterGroups"
import Container from "@/components/ui/Container"
import PageIntro from "@/components/ui/PageIntro"
import TextLink from "@/components/ui/TextLink"
import { useCatalogState } from "@/hooks/useCatalogState"
import useProductQuery from "@/hooks/useProductQuery"
import { useI18n } from "@/i18n/i18nContext"
import { breadcrumbSchema, sitePath } from "@/lib/seo"
import { useStructuredData } from "@/lib/structuredData"
import { collectionPath, paths, type CollectionGender } from "@/router/paths"
import {
  getProductFacets,
  PAGE_SIZE,
  queryProducts,
  retryFullCatalog,
} from "@/services/catalog"
import "./ProductsPage.css"

/*
 * Card design comparison (components/product/cardDesign.ts). Customers get
 * the approved card (A). The Scent Poster card (B) is a separate chunk that
 * is only fetched when that design is selected, and the A/B/C switch exists
 * only on the dev server and the Cloudflare review preview
 * (config/designPreview.ts): in the production build the flag is false, so
 * it is never loaded.
 */
const ProductCardScent = lazy(
  () => import("@/components/product/ProductCardScent"),
)
const ProductCardDossier = lazy(
  () => import("@/components/product/ProductCardDossier"),
)
const CardDesignToggle = designPreview
  ? lazy(() => import("@/components/products/CardDesignToggle"))
  : null

/**
 * The catalogue at /products, or one collection of it (/men-perfumes,
 * /women-perfumes) when `collection` is set: same grid, filters and paging,
 * with the collection's own heading, URL and breadcrumb.
 */
export default function ProductsPage({
  collection,
}: {
  collection?: CollectionGender
}) {
  const [cardDesign, chooseCardDesign] = useCardDesign()
  const { query, update, showMore, clearFilters, clearAll, activeFilterCount } =
    useProductQuery(collection)
  const { addItem } = useBag()
  const { t, locale, localize } = useI18n()
  const copy = t.products
  const basePath = collection ? collectionPath(collection) : paths.products
  const intro = collection ? copy.collections[collection] : copy.intro
  useStructuredData(
    "listing-breadcrumb",
    breadcrumbSchema([
      { name: t.meta.breadcrumb.home, path: sitePath(localize(paths.home)) },
      { name: intro.title, path: sitePath(localize(basePath)) },
    ]),
  )
  // catalog.version in the memo dependencies: recompute when the catalogue changes.
  const catalog = useCatalogState()
  const facets = useMemo(
    () => (catalog.complete ? getProductFacets(locale) : undefined),
    [locale, catalog.version],
  )
  /*
   * View More: `query.page` batches of PAGE_SIZE are shown, always the first
   * products of the one ordered result (1–12, 1–24, 1–36…). Revealing more
   * never reorders; any filter, search or sort change starts again at one
   * batch (useProductQuery).
   */
  const wanted = PAGE_SIZE * query.page
  const queried = useMemo(
    () =>
      catalog.available
        ? queryProducts({ ...query, page: 1 }, locale, wanted)
        : { items: [], total: 0, page: 1, pageCount: 1 },
    [query, locale, wanted, catalog.version],
  )
  /*
   * Live catalogue still arriving (at most the newest page is loaded): the
   * default view shows those products at once with the real total, and
   * placeholders for any more it asked for; any search, filter or sort waits
   * for the full catalogue. Before the first products, every view waits.
   */
  const firstView =
    !collection &&
    !query.search &&
    !activeFilterCount &&
    query.sort === "featured"
  const waiting = !catalog.available || (!catalog.complete && !firstView)
  // The whole catalogue's total only holds for a view of the whole catalogue.
  const totalKnown =
    catalog.complete ||
    (catalog.available &&
      !collection &&
      !query.search &&
      !activeFilterCount)
  // A failed full load before the first products is not final: the first page
  // can still answer, and if it cannot, CatalogGate shows the error.
  const loadFailed = catalog.failed && catalog.available
  const showSkeleton = waiting && !loadFailed
  /*
   * The grid fades in once, only when it replaces placeholders the visitor
   * actually saw. Products that arrive before the skeleton shows
   * (SKELETON_APPEAR_MS) appear at once, with no transition. Decided before
   * paint, so the real cards never flash at full strength first.
   */
  const [revealing, setRevealing] = useState(false)
  const skeletonSince = useRef<number | undefined>(undefined)
  useLayoutEffect(() => {
    if (showSkeleton) {
      skeletonSince.current = performance.now()
      return
    }
    const since = skeletonSince.current
    skeletonSince.current = undefined
    if (since !== undefined && performance.now() - since >= SKELETON_APPEAR_MS)
      setRevealing(true)
  }, [showSkeleton])
  const result = catalog.complete
    ? queried
    : { ...queried, total: catalog.total }
  // Products asked for but not loaded yet (first page only so far).
  const shown = Math.min(wanted, result.total)
  const missing = waiting || catalog.complete ? 0 : shown - result.items.length
  const groups = facets
    ? buildFilterGroups(facets, query, update, copy.groups).filter(
        (group) => !collection || group.id !== "gender",
      )
    : []
  const countLabel = t.common.fragranceCount

  /*
   * A keyboard press on View More moves focus to the first new product, so
   * the next Tab continues through the products just revealed. A pointer
   * click leaves focus (and the scroll position) where it is.
   */
  const grid = useRef<HTMLUListElement>(null)
  const focusFrom = useRef<number | undefined>(undefined)
  const onMore = (event: MouseEvent<HTMLButtonElement>) => {
    focusFrom.current = event.detail === 0 ? result.items.length : undefined
    showMore()
  }
  useEffect(() => {
    const from = focusFrom.current
    if (from === undefined || result.items.length <= from) return
    focusFrom.current = undefined
    grid.current?.children[from]?.querySelector<HTMLElement>("a[href]")?.focus()
  }, [result.items.length])

  return (
    <>
      {/* Unknown count: an empty line keeps the heading where it will stay. */}
      <PageIntro
        intro={intro}
        meta={totalKnown ? countLabel(result.total) : " "}
      >
        {collection && (
          <p className="catalogue__collection-link">
            <TextLink
              link={{
                label: copy.collections.other[collection],
                href: collectionPath(collection === "men" ? "women" : "men"),
              }}
            />
          </p>
        )}
      </PageIntro>

      <Container className="catalogue">
        <FilterSidebar
          groups={groups}
          activeFilterCount={activeFilterCount}
          onClearFilters={clearFilters}
        />

        <div className="catalogue__results">
          {query.search && (
            <p className="catalogue__search">
              {copy.resultsFor(query.search)}
              <button type="button" onClick={() => update({ search: undefined })}>
                {copy.clearSearch}
              </button>
            </p>
          )}

          <ProductToolbar
            groups={groups}
            sort={query.sort}
            onSortChange={(sort) => update({ sort })}
            activeFilterCount={activeFilterCount}
            onClearFilters={clearFilters}
            resultCount={result.total}
            summary={totalKnown ? countLabel(result.total) : undefined}
          />

          {/* Announces the new count when filters, sort or search change. */}
          <p className="visually-hidden" role="status">
            {totalKnown && countLabel(result.total)}
          </p>

          {waiting ? (
            loadFailed ? (
              <div className="catalogue__empty" role="alert">
                <h2>{copy.loadError}</h2>
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => void retryFullCatalog().catch(() => {})}
                >
                  {copy.retry}
                </button>
              </div>
            ) : (
              <>
                <p className="visually-hidden" role="status">
                  {copy.loading}
                </p>
                <ProductGridSkeleton count={PAGE_SIZE} />
              </>
            )
          ) : result.items.length ? (
            <Suspense fallback={null}>
              <ul
                ref={grid}
                className={`catalogue__grid${revealing ? " catalogue__grid--reveal" : ""}`}
                onAnimationEnd={(event) => {
                  if (event.target === event.currentTarget) setRevealing(false)
                }}
              >
                {result.items.map((product, index) => {
                  const position = index + 1
                  return (
                    <li key={product.id}>
                      {cardDesign === "scent" ? (
                        <ProductCardScent
                          product={product}
                          position={position}
                          total={result.total}
                          onAddToBag={addItem}
                          headingLevel="h2"
                        />
                      ) : cardDesign === "dossier" ? (
                        <ProductCardDossier
                          product={product}
                          position={position}
                          onAddToBag={addItem}
                          headingLevel="h2"
                        />
                      ) : (
                        <ProductCard
                          product={product}
                          position={position}
                          onAddToBag={addItem}
                          variant="packshot"
                          headingLevel="h2"
                          eager={index < 2}
                        />
                      )}
                    </li>
                  )
                })}
                {catalog.failed
                  ? null
                  : Array.from({ length: missing }, (_, index) => (
                      <li key={`pending-${index}`} aria-hidden="true">
                        <ProductSkeleton />
                      </li>
                    ))}
              </ul>
              {missing > 0 && catalog.failed && (
                <div className="catalogue__empty" role="alert">
                  <h2>{copy.loadError}</h2>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => void retryFullCatalog().catch(() => {})}
                  >
                    {copy.retry}
                  </button>
                </div>
              )}
            </Suspense>
          ) : (
            <div className="catalogue__empty">
              <h2>{copy.empty.title}</h2>
              <p>{copy.empty.text}</p>
              <button type="button" className="button-primary" onClick={clearAll}>
                {copy.empty.action}
              </button>
            </div>
          )}

          {totalKnown && !waiting && result.items.length > 0 && (
            <LoadMore shown={shown} total={result.total} onMore={onMore} />
          )}
        </div>
      </Container>

      {CardDesignToggle && (
        <Suspense fallback={null}>
          <CardDesignToggle value={cardDesign} onChange={chooseCardDesign} />
        </Suspense>
      )}
    </>
  )
}
