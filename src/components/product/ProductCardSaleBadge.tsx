import type { ReactNode } from "react"
import { useCardSale } from "@/hooks/useCardSale"
import type { Product } from "@/types/catalog"

/**
 * The card's top row. A discounted card shares it between the decorative
 * index (`children`) and the percentage; any other card renders the index
 * alone, with no wrapper, so its markup and layout stay as they were.
 * Shared by every catalogue card design, so a discounted product looks
 * discounted wherever a card shows it. `className` sets a design's own
 * insets (ProductCard.css).
 */
export default function ProductCardSaleBadge({
  product,
  children,
  className,
}: {
  product: Product
  children: ReactNode
  className?: string
}) {
  const percentage = useCardSale(product)?.percentage
  if (percentage === undefined) return children
  return (
    <div className={["product-card__sale-row", className].filter(Boolean).join(" ")}>
      {children}
      <span className="product-sale-badge" aria-hidden="true">
        <bdi dir="ltr">−{percentage}%</bdi>
      </span>
    </div>
  )
}
