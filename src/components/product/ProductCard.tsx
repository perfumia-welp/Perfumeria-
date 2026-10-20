import { useI18n } from "@/i18n/i18nContext"
import { productPath } from "@/router/paths"
import { CHOOSE_OPTION_STATE, needsOptionChoice } from "@/services/catalog"
import type { Product } from "@/types/catalog"
import AppLink from "../ui/AppLink"
import Icon from "../ui/Icon"
import { CATALOGUE_IMAGE_SIZES } from "./imageSizes"
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
}

const pad = (value: number) => String(value).padStart(2, "0")

export default function ProductCard({
  product,
  position,
  onAddToBag,
  variant = "editorial",
  headingLevel: Heading = "h3",
}: ProductCardProps) {
  const { t } = useI18n()
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
  const imageLink = (image: Product["packshot"], sizes?: string) => (
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
        loading="lazy"
        decoding="async"
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
        >
          <span className="product-card__index" aria-hidden="true">
            {pad(position)}
            {product.notes[0] && ` / ${product.notes[0]}`}
          </span>
          {imageLink(product.packshot, CATALOGUE_IMAGE_SIZES)}
          <WishlistButton
            product={product}
            className="product-card__wishlist"
          />
        </div>

        <div className="product-card__body">
          <Heading className="product-card__name">{name}</Heading>
          {details && <p className="product-card__notes">{details}</p>}
          <div className="product-card__purchase">
            <ProductPrice product={product} className="product-card__price" />
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
        <span className="product-card__index" aria-hidden="true">
          {pad(position)}
        </span>
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
          <p>{details}</p>
        </div>
        <ProductPrice product={product} className="product-card__price" />
      </div>
    </article>
  )
}
