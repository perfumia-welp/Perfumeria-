import { useEffect, useState } from "react"
import { useLocation, useParams } from "react-router"
import { useBag } from "@/cart/bagContext"
import QuantityControl from "@/components/cart/QuantityControl"
import ProductCard from "@/components/product/ProductCard"
import ProductGallery from "@/components/product/ProductGallery"
import ProductOptions from "@/components/product/ProductOptions"
import ProductPrice from "@/components/product/ProductPrice"
import WishlistButton from "@/components/product/WishlistButton"
import AppLink from "@/components/ui/AppLink"
import Container from "@/components/ui/Container"
import Icon from "@/components/ui/Icon"
import { useLiveProduct, type DetailStatus } from "@/hooks/useLiveProduct"
import { useProductOptions } from "@/hooks/useProductOptions"
import { useI18n } from "@/i18n/i18nContext"
import { formatSize } from "@/lib/formatSize"
import {
  breadcrumbSchema,
  productSchema,
  sitePath,
  type Crumb,
} from "@/lib/seo"
import { useStructuredData } from "@/lib/structuredData"
import {
  COLLECTIONS,
  collectionPath,
  paths,
  productPath,
  productsWith,
  type CollectionGender,
} from "@/router/paths"
import {
  catalogGenders,
  getOptionPriceRange,
  getRelatedProducts,
} from "@/services/catalog"
import type { Product } from "@/types/catalog"
import NotFoundPage from "./NotFoundPage"
import "./ProductPage.css"

/**
 * Product detail page at /products/:slug. Live products load their company
 * detail on first view; unknown slugs show the 404 page once nothing is
 * still loading.
 */
export default function ProductPage() {
  const { slug = "" } = useParams()
  const { t } = useI18n()
  const { product, detailStatus, retry, catalog } = useLiveProduct(slug)
  if (!product) {
    if (detailStatus === "loading" || (!catalog.complete && !catalog.failed))
      return (
        <Container className="pdp pdp--loading">
          <p className="pdp__label" role="status">
            {t.product.loading}
          </p>
        </Container>
      )
    return <NotFoundPage />
  }
  // Keyed so quantity and gallery reset when moving to a related product.
  return (
    <ProductDetail
      key={product.id}
      product={product}
      detailStatus={detailStatus}
      retry={retry}
    />
  )
}

function ProductDetail({
  product,
  detailStatus,
  retry,
}: {
  product: Product
  detailStatus: DetailStatus
  retry: () => void
}) {
  const { addItem } = useBag()
  const [quantity, setQuantity] = useState(1)
  const { t, locale, localize } = useI18n()
  const copy = t.product
  const options = useProductOptions(product, detailStatus, retry)
  // Sent here by a card's Add to Bag: say a choice is needed once options show.
  const chooseOption =
    (useLocation().state as { chooseOption?: boolean } | null)?.chooseOption === true
  const { status: optionsStatus, showRequired } = options
  useEffect(() => {
    if (chooseOption && optionsStatus === "ready" && product.requiresOptionSelection)
      showRequired()
  }, [chooseOption, optionsStatus, product.requiresOptionSelection, showRequired])
  const list = (items: string[]) => items.join(t.common.listSeparator)
  const size = (value: string) => formatSize(value, t.common.millilitres)
  const family = product.family
    ? t.catalog.families[product.family]
    : (product.fragranceFamily ?? "")
  const gender = product.gender ? t.catalog.genders[product.gender] : ""
  const sizes = product.size ? [product.size] : []
  const story = product.story
  const related = getRelatedProducts(product, locale)
  // The gender's collection page, when the catalogue has that category.
  const collection = COLLECTIONS.find(
    (value): value is CollectionGender =>
      value === product.gender && catalogGenders.includes(value),
  )
  const genderHref = collection
    ? collectionPath(collection)
    : product.gender && productsWith("gender", product.gender)

  /*
   * Structured data from the product's real data only. Live products wait
   * for their company detail, so a box / no-box price range is known and no
   * single misleading price is stated; nothing is added if it fails.
   */
  const crumbs: Crumb[] = [
    { name: t.meta.breadcrumb.home, path: sitePath(localize(paths.home)) },
    { name: copy.breadcrumbRoot, path: sitePath(localize(paths.products)) },
    ...(collection
      ? [{ name: gender, path: sitePath(localize(collectionPath(collection))) }]
      : []),
    {
      name: product.name,
      path: sitePath(localize(productPath(product.slug))),
    },
  ]
  useStructuredData("product-breadcrumb", breadcrumbSchema(crumbs))
  useStructuredData(
    "product-structured-data",
    detailStatus === "ready"
      ? productSchema({
          product,
          path: sitePath(localize(productPath(product.slug))),
          size: product.size && size(product.size),
          priceRange: getOptionPriceRange(product),
          description:
            !product.contentLocale ||
            product.contentLocale.description === locale
              ? story?.description
              : undefined,
        })
      : null,
  )

  const details = [
    { label: copy.details.family, value: family },
    { label: copy.details.for, value: gender },
    { label: copy.details.size, value: product.size && size(product.size) },
    { label: copy.details.keyNotes, value: list(product.notes) },
    {
      label: copy.details.availability,
      value: product.inStock ? copy.details.inStock : copy.details.outOfStock,
    },
  ].filter((row) => row.value)

  return (
    <article className="pdp" aria-labelledby="pdp-title">
      <Container className="pdp__top">
        <nav className="pdp__breadcrumb" aria-label={copy.breadcrumb}>
          <ol>
            <li>
              <AppLink href={paths.products}>{copy.breadcrumbRoot}</AppLink>
            </li>
            {product.family ? (
              <li>
                <AppLink href={productsWith("family", product.family)}>
                  {family}
                </AppLink>
              </li>
            ) : (
              genderHref && (
                <li>
                  <AppLink href={genderHref}>
                    {gender}
                  </AppLink>
                </li>
              )
            )}
            <li>
              <span aria-current="page">{product.name}</span>
            </li>
          </ol>
        </nav>

        <div className="pdp__layout">
          <ProductGallery product={product} />

          <div className="pdp__purchase">
            <p className="eyebrow">
              {[family, gender].filter(Boolean).join(" · ")}
            </p>
            <h1 id="pdp-title" className="pdp__title">
              {product.name}
            </h1>
            {product.notes.length > 0 && (
              <p className="pdp__notes">{product.notes.join(" · ")}</p>
            )}
            <ProductPrice
              product={options.selected ?? product}
              className="pdp__price"
            />
            <p
              className={`pdp__availability${
                product.inStock ? "" : " is-unavailable"
              }`}
            >
              {product.inStock ? copy.inStock : copy.outOfStock}
            </p>

            {sizes.length > 0 && (
              <fieldset className="pdp__option">
                <legend className="pdp__label">{copy.size}</legend>
                <div className="pdp__sizes">
                  {sizes.map((value) => (
                    <label key={value} className="pdp__size">
                      <input
                        type="radio"
                        name="pdp-size"
                        value={value}
                        defaultChecked
                      />
                      <span>{formatSize(value, t.common.millilitres)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {product.inStock && product.requiresOptionSelection && (
              <ProductOptions state={options} />
            )}

            {product.inStock && (
              <div className="pdp__option">
                <span className="pdp__label" aria-hidden="true">
                  {copy.quantity}
                </span>
                <QuantityControl
                  productName={product.name}
                  quantity={quantity}
                  onChange={setQuantity}
                />
              </div>
            )}

            <div className="pdp__actions">
              {product.inStock ? (
                <button
                  type="button"
                  className="button-primary pdp__add"
                  onClick={() => {
                    if (!product.requiresOptionSelection)
                      return addItem(product, quantity)
                    if (options.selected) return addItem(options.selected, quantity)
                    options.showRequired()
                  }}
                >
                  {copy.addToBag} <Icon name="arrow" />
                </button>
              ) : (
                <p className="pdp__sold-out">{copy.soldOut}</p>
              )}
              <WishlistButton product={product} variant="text" />
            </div>

            <p className="pdp__service">{copy.service}</p>
          </div>
        </div>
      </Container>

      <Container className="pdp__story">
        {story && (
          <>
            {story.description && (
              <section
                className="pdp-section"
                aria-labelledby="pdp-description"
              >
                <h2 id="pdp-description" className="pdp-section__label">
                  {copy.sections.fragrance}
                </h2>
                <p
                  className={`pdp__description${
                    story.description.length > 160 ||
                    story.description.includes("\n")
                      ? " pdp__description--copy"
                      : ""
                  }`}
                  {...(product.contentLocale?.description === "en" &&
                  locale !== "en"
                    ? { lang: "en", dir: "auto" }
                    : {})}
                >
                  {story.description}
                </p>
              </section>
            )}

            {Object.values(story.composition).some((notes) => notes.length) && (
              <section
                className="pdp-section"
                aria-labelledby="pdp-composition"
              >
                <h2 id="pdp-composition" className="pdp-section__label">
                  {copy.sections.composition}
                </h2>
                <dl className="pdp__composition">
                  {([
                    [copy.composition.top, story.composition.top],
                    [copy.composition.heart, story.composition.heart],
                    [copy.composition.base, story.composition.base],
                  ] as const)
                    .filter(([, notes]) => notes.length)
                    .map(([label, notes]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{list(notes)}</dd>
                      </div>
                    ))}
                </dl>
              </section>
            )}

            {story.character.length > 0 && (
              <section className="pdp-section" aria-labelledby="pdp-character">
                <h2 id="pdp-character" className="pdp-section__label">
                  {copy.sections.character}
                </h2>
                <ul className="pdp__character">
                  {story.character.map((word) => (
                    <li key={word}>{word}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <section className="pdp-section" aria-labelledby="pdp-details">
          <h2 id="pdp-details" className="pdp-section__label">
            {copy.sections.details}
          </h2>
          <dl className="pdp__details">
            {details.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </Container>

      {related.length > 0 && (
        <Container
          as="section"
          className="pdp__related"
          aria-labelledby="pdp-related"
        >
          <p className="eyebrow">{copy.related.eyebrow}</p>
          <h2 id="pdp-related" className="pdp__related-title">
            {copy.related.title}
          </h2>
          <ul className="pdp__related-grid">
            {related.map((item, index) => (
              <li key={item.id}>
                <ProductCard
                  product={item}
                  position={index + 1}
                  onAddToBag={addItem}
                  variant="packshot"
                />
              </li>
            ))}
          </ul>
        </Container>
      )}
    </article>
  )
}
