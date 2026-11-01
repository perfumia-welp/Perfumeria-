import "@/components/product/ProductCard.css"
import "./ProductGridSkeleton.css"

const NBSP = " "

/**
 * Stands in for the catalogue grid while its products are on their way.
 * Built from the packshot card's own layout classes (no text, no controls),
 * so it has the card's geometry at every width and in both languages. All
 * `count` cells are laid out to hold the page still; only the first two rows
 * are shown (ProductGridSkeleton.css).
 */
export default function ProductGridSkeleton({ count }: { count: number }) {
  return (
    <ul className="catalogue__grid product-skeletons" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <div className="product-card--packshot product-skeleton">
            <div className="product-card__stage">
              <span className="product-skeleton__bottle" />
            </div>
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
        </li>
      ))}
    </ul>
  )
}
