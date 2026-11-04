import type { ReactNode } from "react"
import { productSale } from "@/lib/productSale"
import type { Product } from "@/types/catalog"

/**
 * The card's top row. A discounted card shares it between the decorative
 * index (`children`) and the percentage; any other card renders the index
 * alone, with no wrapper, so its markup and layout stay as they were.
 */
export default function ProductCardSaleBadge({
  product,
  children,
}: {
  product: Product
  children: ReactNode
}) {
  const percentage = productSale(product)?.percentage
  if (percentage === undefined) return children
  return (
    <div className="product-card__sale-row">
      {children}
      <span className="product-sale-badge" aria-hidden="true">
        <bdi dir="ltr">−{percentage}%</bdi>
      </span>
    </div>
  )
}
