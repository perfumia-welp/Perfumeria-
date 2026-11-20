import { useId } from "react"
import { useI18n } from "@/i18n/i18nContext"
import { formatPrice } from "@/lib/formatPrice"
import { orderLineName } from "@/lib/orderRequest"
import type { OrderRequest } from "@/types/order"

/** The server's corrected prices, to confirm before the order is stored. */
export default function QuoteNotice({ order }: { order: OrderRequest }) {
  const titleId = useId()
  const { t, locale } = useI18n()
  const copy = t.checkout
  const price = (amount: number) => formatPrice(amount, order.currency, locale)
  return (
    <section className="checkout-quote" aria-labelledby={titleId}>
      <h3 id={titleId} className="checkout-quote__title">
        {copy.quote.title}
      </h3>
      <ul className="checkout-quote__lines">
        {order.lines.map((line) => (
          <li key={line.productId}>
            <span>
              <bdi>{orderLineName(line, locale)}</bdi> × {line.quantity}
            </span>
            <bdi>{price(line.lineTotal)}</bdi>
          </li>
        ))}
        {order.promotion && (
          <li>
            <span>{t.cart.promotion.name}</span>
            <bdi>{t.cart.promotion.lineDiscount(price(order.promotion.discount))}</bdi>
          </li>
        )}
      </ul>
      <p className="checkout-quote__total">
        <span>{copy.quote.total}</span>
        <bdi>{price(order.displayedTotal)}</bdi>
      </p>
    </section>
  )
}
