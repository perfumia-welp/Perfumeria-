import { useProductDetail } from "@/hooks/useProductDetail"
import { useI18n } from "@/i18n/i18nContext"
import { formatPrice } from "@/lib/formatPrice"
import { getOptionPriceRange } from "@/services/catalog"
import type { Product } from "@/types/catalog"
import "./ProductCard.css"

/**
 * Current price, preceded by the struck-through original when discounted.
 *
 * A product whose price depends on a required choice (with box / without
 * box) shows "From" its lowest option price until an option is chosen; its
 * listed price is not reliably either option. The option prices come with
 * the product detail, fetched for that product only when it is shown.
 */
export default function ProductPrice({
  product,
  className,
}: {
  product: Product
  className?: string
}) {
  const { t, locale } = useI18n()
  const needsChoice =
    product.requiresOptionSelection === true && !product.selectedOptions
  const detail = useProductDetail(
    needsChoice && !product.variations?.length ? product : undefined,
  )
  const price = (amount: number) => formatPrice(amount, product.currency, locale)

  if (needsChoice) {
    const range = getOptionPriceRange(product.variations?.length ? product : (detail ?? product))
    if (!range)
      // Options still loading: hold the line's space without a misleading price.
      return (
        <p className={`${className ?? ""} product-price--pending`} aria-hidden="true">
          <span className="product-card__current-price">{price(product.price)}</span>
        </p>
      )
    return (
      <p className={className}>
        <span className="product-card__current-price">
          {range.min < range.max && (
            <span className="product-price__from">{t.common.price.from} </span>
          )}
          {price(range.min)}
        </span>
      </p>
    )
  }

  const { compareAtPrice } = product
  const isDiscounted =
    compareAtPrice !== undefined && compareAtPrice > product.price

  return (
    <p className={className}>
      {isDiscounted && (
        <>
          <span className="visually-hidden">{t.common.price.original}</span>
          <s>{price(compareAtPrice)}</s>
          <span className="visually-hidden">{t.common.price.sale}</span>{" "}
        </>
      )}
      <span className="product-card__current-price">{price(product.price)}</span>
    </p>
  )
}
