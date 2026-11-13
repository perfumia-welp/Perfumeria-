import { useI18n } from "@/i18n/i18nContext"

/**
 * The Buy 3 — Cheapest Item Free rows of an order summary, placed in its
 * <dl> right after Subtotal: the discount, then the final product subtotal.
 * Renders nothing when there is no discount.
 */
export default function PromotionRows({
  discount,
  total,
  price,
}: {
  discount: number
  /** Product subtotal after the discount. */
  total: number
  price: (amount: number) => string
}) {
  const { t } = useI18n()
  const copy = t.cart.promotion
  if (discount <= 0) return null
  return (
    <>
      <div className="order-summary__promotion">
        <dt>{copy.name}</dt>
        <dd>
          <bdi>{copy.lineDiscount(price(discount))}</bdi>
        </dd>
      </div>
      <div className="order-summary__final">
        <dt>{copy.finalSubtotal}</dt>
        <dd>{price(total)}</dd>
      </div>
    </>
  )
}
