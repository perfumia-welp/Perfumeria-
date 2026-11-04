import { useI18n } from "@/i18n/i18nContext"
import { productSale } from "@/lib/productSale"
import type { Product } from "@/types/catalog"

export default function ProductSaleBadges({ product }: { product: Product }) {
  const { t } = useI18n()
  const sale = productSale(product)
  if (!sale) return null
  return (
    <div className="product-card__sale-badges" aria-hidden="true">
      <span className="product-sale-badge product-card__sale-label">{t.common.price.saleBadge}</span>
      {sale.percentage !== undefined && (
        <span className="product-sale-badge product-card__sale-percent">
          <bdi dir="ltr">−{sale.percentage}%</bdi>
        </span>
      )}
    </div>
  )
}
