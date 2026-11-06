import "@/components/product/ProductCard.css"
import "./ProductGridSkeleton.css"

/** A no-break space: gives each bar a real line box. */
const NBSP = " "

/**
 * One product on its way, in the same shape as the card it stands in for:
 * "packshot" (catalogue grids) or "editorial" (homepage offers). Both are
 * built from that card's own layout classes, without `.product-card`, so
 * audits and tests counting cards ignore them. The image area is an empty,
 * neutral surface: it says an image is coming, never what it shows.
 */
export function ProductSkeleton({
  variant = "packshot",
}: {
  variant?: "packshot" | "editorial"
}) {
  if (variant === "editorial")
    return (
      <div className="product-skeleton product-skeleton--editorial">
        <div className="product-card__media product-skeleton__image" />
        <div className="product-card__details">
          <span className="product-card__info">
            <span className="product-skeleton__name product-skeleton__line">{NBSP}</span>
            <span className="product-skeleton__notes product-skeleton__line">{NBSP}</span>
          </span>
          <span className="product-card__price product-skeleton__price product-skeleton__line">
            {NBSP}
          </span>
        </div>
      </div>
    )

  return (
    <div className="product-card--packshot product-skeleton">
      <div className="product-card__stage product-skeleton__image" />
      <div className="product-card__body">
        {/* Two lines: the tallest name that usually sets a row's height. */}
        <span className="product-card__name product-skeleton__name">
          <span className="product-skeleton__line">{NBSP}</span>
          <span className="product-skeleton__line">{NBSP}</span>
        </span>
        <span className="product-card__notes product-skeleton__line product-skeleton__notes">
          {NBSP}
        </span>
        <span className="product-card__purchase">
          <span className="product-card__price product-skeleton__line product-skeleton__price">
            {NBSP}
          </span>
          <span className="product-card__add-link product-skeleton__line product-skeleton__action">
            {NBSP}
          </span>
        </span>
      </div>
    </div>
  )
}

/**
 * Stands in for the catalogue grid while its products are on their way (no
 * text, no controls), with the card's geometry at every width and in both
 * languages. All `count` cells are laid out to hold the page still; only the
 * first two rows are shown (ProductGridSkeleton.css).
 */
export default function ProductGridSkeleton({ count }: { count: number }) {
  return (
    <ul className="catalogue__grid product-skeletons" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <ProductSkeleton />
        </li>
      ))}
    </ul>
  )
}
