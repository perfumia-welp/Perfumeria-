import { useState, type CSSProperties, type SyntheticEvent } from "react"
import { useI18n } from "@/i18n/i18nContext"
import { productSale } from "@/lib/productSale"
import { productPath } from "@/router/paths"
import { CHOOSE_OPTION_STATE, needsOptionChoice } from "@/services/catalog"
import type { Product } from "@/types/catalog"
import AppLink from "../ui/AppLink"
import Icon from "../ui/Icon"
import { CATALOGUE_IMAGE_SIZES } from "./imageSizes"
import ProductCardSaleBadge from "./ProductCardSaleBadge"
import ProductPrice from "./ProductPrice"
import WishlistButton from "./WishlistButton"
import "./ProductCard.css"

interface ProductCardProps {
  product: Product
  /** Editorial index shown on the image ("01", "02"…). */
  position: number
  onAddToBag: (product: Product) => void
  /**
   * "editorial" — photographic card used on the homepage.
   * "packshot" — transparent bottle on a neutral surface (catalogue).
   */
  variant?: "editorial" | "packshot"
  /** Heading level for the product name, to fit the page outline. */
  headingLevel?: "h2" | "h3"
  /** In view as the page opens (the first row): load the photo at once, not lazily. */
  eager?: boolean
}

const pad = (value: number) => String(value).padStart(2, "0")

export default function ProductCard({
  product,
  position,
  onAddToBag,
  variant = "editorial",
  headingLevel: Heading = "h3",
  eager = false,
}: ProductCardProps) {
  const { t } = useI18n()
  /*
   * Catalogue card only: the percentage sits in the top-left corner of the
   * photograph itself. Photos are drawn whole (object-fit: contain) and come
   * square or portrait, so the badge needs the photo's shape to find its
   * corner (ProductCard.css). Until the photo loads it assumes square.
   */
  const salePercentage =
    variant === "packshot" ? productSale(product)?.percentage : undefined
  const [photoRatio, setPhotoRatio] = useState<number>()
  const details = [
    ...product.notes,
    product.size && t.common.compactSize(product.size),
  ]
    .filter(Boolean)
    .join(" · ")
  const href = productPath(product.slug)
  /*
   * The image repeats the name link for pointer users only; keyboard and
   * screen-reader users reach the product page once, through the name.
   */
  const imageLink = (
    image: Product["packshot"],
    sizes?: string,
    onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void,
  ) => (
    <AppLink
      className="product-card__image-link"
      href={href}
      tabIndex={-1}
      aria-hidden="true"
    >
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes={sizes}
        alt={image.alt || product.name}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={onLoad}
      />
    </AppLink>
  )
  const name = (
    <AppLink className="product-card__link" href={href}>
      {product.name}
    </AppLink>
  )

  if (variant === "packshot") {
    return (
      <article className="product-card product-card--packshot">
        <div
          className={`product-card__stage${product.packshotStyle === "photo" ? " product-card__stage--photo" : ""}`}
          style={
            salePercentage !== undefined && photoRatio
              ? ({ "--photo-ratio": photoRatio } as CSSProperties)
              : undefined
          }
        >
          <span className="product-card__index" aria-hidden="true">
            {pad(position)}
            {product.notes[0] && ` / ${product.notes[0]}`}
          </span>
          {imageLink(
            product.packshot,
            CATALOGUE_IMAGE_SIZES,
            salePercentage === undefined
              ? undefined
              : (event) => {
                  const { naturalWidth: w, naturalHeight: h } = event.currentTarget
                  if (w > 0 && h > 0) setPhotoRatio(Math.round((w / h) * 1000) / 1000)
                },
          )}
          {salePercentage !== undefined && (
            <span className="product-sale-badge product-card__photo-badge" aria-hidden="true">
              <bdi dir="ltr">−{salePercentage}%</bdi>
            </span>
          )}
          <WishlistButton
            product={product}
            className="product-card__wishlist"
          />
        </div>

        <div className="product-card__body">
          <Heading className="product-card__name">{name}</Heading>
          {details && <p className="product-card__notes">{details}</p>}
          <div className="product-card__purchase">
            <ProductPrice product={product} className="product-card__price" salePresentation />
            {product.inStock && needsOptionChoice(product) ? (
              <AppLink
                className="product-card__add-link"
                href={href}
                state={CHOOSE_OPTION_STATE}
                aria-label={t.product.chooseOptionsLabel(product.name)}
              >
                {t.product.chooseOptions} <Icon name="arrow" />
              </AppLink>
            ) : product.inStock ? (
              <button
                type="button"
                className="product-card__add-link"
                aria-label={t.product.addToBagLabel(product.name)}
                onClick={() => onAddToBag(product)}
              >
                {t.product.addToBag} <Icon name="arrow" />
              </button>
            ) : (
              <span className="product-card__unavailable">
                {t.product.outOfStock}
              </span>
            )}
          </div>
        </div>
      </article>
    )
  }

  // Editorial photography where available; the packshot is the fallback.
  const image = product.image ?? product.packshot

  return (
    <article className="product-card">
      <div className="product-card__media">
        <ProductCardSaleBadge product={product}>
          <span className="product-card__index" aria-hidden="true">
            {pad(position)}
          </span>
        </ProductCardSaleBadge>
        {imageLink(
          image,
          "(max-width: 767px) 79vw, (max-width: 1023px) 38vw, (max-width: 1295px) 23vw, 306px",
        )}
        {needsOptionChoice(product) ? (
          <AppLink
            className="product-card__add"
            href={href}
            state={CHOOSE_OPTION_STATE}
            aria-label={t.product.chooseOptionsLabel(product.name)}
          >
            {t.product.chooseOptionsShort}
          </AppLink>
        ) : (
          <button
            type="button"
            className="product-card__add"
            aria-label={t.product.addToBagLabel(product.name)}
            onClick={() => onAddToBag(product)}
          >
            {t.product.addToBagShort}
          </button>
        )}
      </div>

      <div className="product-card__details">
        <div className="product-card__info">
          <Heading>{name}</Heading>
          {/* No details line is invented; the price below still meets its neighbours'. */}
          {details && <p>{details}</p>}
        </div>
        <ProductPrice product={product} className="product-card__price" salePresentation />
      </div>
    </article>
  )
}
