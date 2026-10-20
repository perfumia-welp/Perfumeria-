import { useId } from "react"
import type { BagGift } from "@/cart/bagContext"
import { useI18n } from "@/i18n/i18nContext"
import { formatPrice } from "@/lib/formatPrice"
import { formatSize } from "@/lib/formatSize"
import { paths } from "@/router/paths"
import type { CartItem } from "@/types/commerce"
import AppLink from "../ui/AppLink"

interface CheckoutSummaryProps {
  items: CartItem[]
  subtotal: number
  currency: string
  gift: BagGift
  promoCode: string
}

/**
 * The bag as it will be requested. Shares the Cart's order-summary panel.
 * Shipping and tax are never estimated: the store confirms them.
 */
export default function CheckoutSummary({
  items,
  subtotal,
  currency,
  gift,
  promoCode,
}: CheckoutSummaryProps) {
  const titleId = useId()
  const { t, locale } = useI18n()
  const copy = t.checkout.summary
  const price = (amount: number) => formatPrice(amount, currency, locale)
  const code = promoCode.trim()

  return (
    <aside className="order-summary checkout-summary" aria-labelledby={titleId}>
      <h2 id={titleId} className="order-summary__title">
        {copy.title}
      </h2>

      <ul className="checkout-lines">
        {items.map(({ product, quantity }) => (
          <li key={product.id} className="checkout-line">
            <div className="checkout-line__image">
              <img src={product.packshot.src} srcSet={product.packshot.srcSet} sizes="120px" alt="" loading="lazy" />
            </div>
            <div className="checkout-line__details">
              <p className="checkout-line__name">{product.name}</p>
              {product.size && (
                <p>{formatSize(product.size, t.common.millilitres)}</p>
              )}
              <p>
                <span className="visually-hidden">{copy.quantity}</span>
                {quantity} × {price(product.price)}
              </p>
            </div>
            <p className="checkout-line__total">
              <span className="visually-hidden">{copy.lineTotal}</span>
              {price(product.price * quantity)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="order-summary__rows">
        <div>
          <dt>{copy.subtotal}</dt>
          <dd>{price(subtotal)}</dd>
        </div>
        <div>
          <dt>{copy.shipping}</dt>
          <dd>{copy.confirmedByStore}</dd>
        </div>
        <div>
          <dt>{copy.tax}</dt>
          <dd>{copy.confirmedByStore}</dd>
        </div>
      </dl>

      {(gift.isGift || code) && (
        <dl className="checkout-summary__extras">
          {gift.isGift && (
            <div>
              <dt>{copy.giftMessage}</dt>
              <dd>{gift.message.trim() || copy.giftNoMessage}</dd>
            </div>
          )}
          {code && (
            <div>
              <dt>{copy.promoCode}</dt>
              <dd>
                {code}
                <span className="checkout-summary__qualifier">
                  {copy.promoNotApplied}
                </span>
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="order-summary__total">
        <span>{copy.total}</span>
        <strong>{price(subtotal)}</strong>
      </div>
      <p className="order-summary__fineprint">{copy.fineprint}</p>
      <AppLink className="checkout-summary__edit" href={paths.cart}>
        {copy.editBag}
      </AppLink>
    </aside>
  )
}
