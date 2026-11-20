import { useEffect, useId, useRef, useState } from "react"
import ProductOptions from "@/components/product/ProductOptions"
import Icon from "@/components/ui/Icon"
import { useCatalogState } from "@/hooks/useCatalogState"
import { useLiveProduct } from "@/hooks/useLiveProduct"
import { useProductOptions } from "@/hooks/useProductOptions"
import { useI18n } from "@/i18n/i18nContext"
import { formatPrice } from "@/lib/formatPrice"
import { searchProducts } from "@/services/catalog"
import type { Product } from "@/types/catalog"
import type { OrderLine } from "@/types/order"
import "@/pages/ProductPage.css"

/** A new order line for a product (its options picked), at its current price. */
function lineFor(product: Product): OrderLine {
  return {
    welpProductId: product.productId,
    options: (product.selectedOptions ?? []).map(({ variationId, optionId }) => ({
      variationId,
      optionId,
    })),
    productId: product.id,
    name: product.name,
    size: null,
    quantity: 1,
    unitPrice: product.price,
    lineTotal: product.price,
    imageUrl: product.packshot.src || null,
  }
}

/**
 * "Add a Product" inside Edit Order: search the catalogue, pick a product
 * (and its box choice when it has one), add it to the order being edited.
 * The shopping bag is never touched. The product's live detail is loaded
 * first, so availability, options and price are current; the server
 * re-verifies all of it when the order is saved.
 */
export default function OrderAddProduct({ onAdd }: { onAdd: (line: OrderLine) => void }) {
  const { t, locale } = useI18n()
  const copy = t.checkout.edit
  const baseId = useId()
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState("")
  const [chosen, setChosen] = useState<Product | null>(null)
  const [added, setAdded] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  useCatalogState()

  useEffect(() => {
    if (open && !chosen) searchRef.current?.focus()
  }, [open, chosen])

  const close = () => {
    setOpen(false)
    setChosen(null)
    setTerm("")
    toggleRef.current?.focus()
  }

  const query = term.trim()
  const results = query.length >= 2 ? searchProducts(query, locale, 8).items : []

  return (
    <div className="order-add">
      <p className="visually-hidden" role="status">
        {added}
      </p>
      {!open ? (
        <button
          ref={toggleRef}
          type="button"
          className="checkout-link order-add__toggle"
          aria-expanded={false}
          onClick={() => {
            setAdded("")
            setOpen(true)
          }}
        >
          + {copy.addProduct}
        </button>
      ) : (
        <div className="order-add__panel" role="group" aria-labelledby={`${baseId}-title`}>
          <div className="order-add__head">
            <p id={`${baseId}-title`} className="order-add__title">
              {copy.addProduct}
            </p>
            <button type="button" className="checkout-link" onClick={close}>
              {copy.closeAdd}
            </button>
          </div>
          {chosen ? (
            <ChosenProduct
              slug={chosen.slug}
              onBack={() => setChosen(null)}
              onAdd={(product) => {
                onAdd(lineFor(product))
                setAdded(copy.added(product.name))
                close()
              }}
            />
          ) : (
            <>
              <label className="visually-hidden" htmlFor={`${baseId}-search`}>
                {copy.searchLabel}
              </label>
              <input
                ref={searchRef}
                id={`${baseId}-search`}
                className="order-add__search"
                type="search"
                autoComplete="off"
                placeholder={copy.searchPlaceholder}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
              />
              {query.length < 2 ? (
                <p className="order-add__hint">{copy.searchHint}</p>
              ) : results.length === 0 ? (
                <p className="order-add__hint" role="status">
                  {copy.noResults}
                </p>
              ) : (
                <ul className="order-add__results">
                  {results.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        className="order-add__result"
                        aria-disabled={!product.inStock}
                        onClick={() => product.inStock && setChosen(product)}
                      >
                        <span className="order-add__result-name">{product.name}</span>
                        <span className="order-add__result-meta">
                          {product.inStock
                            ? formatPrice(product.price, product.currency, locale)
                            : t.product.soldOut}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** The picked product, from its live detail: options, availability, price. */
function ChosenProduct({
  slug,
  onBack,
  onAdd,
}: {
  slug: string
  onBack: () => void
  onAdd: (product: Product) => void
}) {
  const { t, locale } = useI18n()
  const copy = t.checkout.edit
  const { product, detailStatus, retry } = useLiveProduct(slug)
  const options = useProductOptions(
    product ?? ({ id: "", slug, variations: [] } as unknown as Product),
    detailStatus,
    retry,
  )
  if (!product) return <p className="order-add__hint">{copy.noResults}</p>

  const loading = detailStatus === "loading"
  const line = product.requiresOptionSelection ? options.selected : product
  const shownPrice = line?.price ?? product.price
  return (
    <div className="order-add__chosen">
      <p className="order-add__chosen-name">{product.name}</p>
      <p className="order-add__chosen-price">
        {loading
          ? t.product.options.loading
          : product.inStock
            ? formatPrice(shownPrice, product.currency, locale)
            : t.product.soldOut}
      </p>
      {!loading && product.inStock && product.requiresOptionSelection && (
        <ProductOptions state={options} />
      )}
      {detailStatus === "error" && (
        <button type="button" className="checkout-link" onClick={retry}>
          {t.product.options.retry}
        </button>
      )}
      <div className="order-add__actions">
        {product.inStock && (
          <button
            type="button"
            className="button-primary order-add__confirm"
            aria-disabled={loading || detailStatus === "error"}
            onClick={() => {
              if (loading || detailStatus === "error") return
              if (!product.requiresOptionSelection) return onAdd(product)
              if (options.selected) return onAdd(options.selected)
              options.showRequired()
            }}
          >
            {copy.addToOrder} <Icon name="arrow" />
          </button>
        )}
        <button type="button" className="checkout-link" onClick={onBack}>
          {copy.backToResults}
        </button>
      </div>
    </div>
  )
}
