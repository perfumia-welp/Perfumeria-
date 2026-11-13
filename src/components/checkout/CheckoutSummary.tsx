import { useId } from "react"
import type { BagGift } from "@/cart/bagContext"
import { useI18n } from "@/i18n/i18nContext"
import { formatPrice } from "@/lib/formatPrice"
import { formatSize } from "@/lib/formatSize"
import { ORDER_TAX } from "@/lib/orderTax"
import { paths } from "@/router/paths"
import type { CartItem } from "@/types/commerce"
import PromotionFreeNote from "../cart/PromotionFreeNote"
import PromotionRows from "../cart/PromotionRows"
import AppLink from "../ui/AppLink"

interface CheckoutSummaryProps {
  items: CartItem[]
  /** Product subtotal before the Buy 3 promotion. */
  subtotal: number
  /** Buy 3 — Cheapest Item Free discount (0 when the order has none). */
  discount: number
  /** What the customer pays for the products: subtotal − discount. */
  total: number
  /** Free units per line id. */
  freeByLine: ReadonlyMap<string, number>
  currency: string
  gift: BagGift
  promoCode: string
}

/**
 * The bag as it will be requested. Shares the Cart's order-summary panel.
 * Shipping is never estimated: the store confirms it. Tax is always zero.
 */
export default function CheckoutSummary({
  items,
  subtotal,
  discount,
  total,
  freeByLine,
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
          <li
            key={product.id}
            className="checkout-line"
            data-product-id={product.id}
          >
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
              {(freeByLine.get(product.id) ?? 0) > 0 && (
                <PromotionFreeNote
                  className="checkout-line__promo"
                  freeQuantity={freeByLine.get(product.id) ?? 0}
                  quantity={quantity}
                  discount={price(
                    product.price * (freeByLine.get(product.id) ?? 0),
                  )}
                />
              )}
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
        <PromotionRows discount={discount} total={total} price={price} />
        <div>
          <dt>{copy.shipping}</dt>
          <dd>{copy.confirmedByStore}</dd>
        </div>
        <div>
          <dt>{copy.tax}</dt>
          <dd>{price(ORDER_TAX)}</dd>
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
        <strong>{price(total)}</strong>
      </div>
      <p className="order-summary__fineprint">{copy.fineprint}</p>
      <AppLink className="checkout-summary__edit" href={paths.cart}>
        {copy.editBag}
      </AppLink>
    </aside>
  )
}
