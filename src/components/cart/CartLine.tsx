import { useI18n } from "@/i18n/i18nContext"
import { formatPrice } from "@/lib/formatPrice"
import { formatSize } from "@/lib/formatSize"
import type { CartItem } from "@/types/commerce"
import QuantityControl from "./QuantityControl"

/** One bag line: packshot, details, unit price, quantity and Remove. */
export default function CartLine({
  item,
  onQuantityChange,
  onRemove,
}: {
  item: CartItem
  onQuantityChange: (quantity: number) => void
  onRemove: () => void
}) {
  const { product, quantity } = item
  const { t, locale } = useI18n()
  const copy = t.cart.line
  const price = (amount: number) =>
    formatPrice(amount, product.currency, locale)

  return (
    <li className="cart-line" data-product-id={product.id}>
      <div className="cart-line__image">
        <img src={product.packshot.src} srcSet={product.packshot.srcSet} sizes="120px" alt="" loading="lazy" />
      </div>

      <div className="cart-line__details">
        <h2>{product.name}</h2>
        <p>{product.notes.join(" · ")}</p>
        {product.size && (
          <p>{formatSize(product.size, t.common.millilitres)}</p>
        )}
        <p className="cart-line__price">
          {price(product.price)}
          {quantity > 1 && (
            <span className="cart-line__line-total">
              {copy.lineTotal(price(product.price * quantity), quantity)}
            </span>
          )}
        </p>
      </div>

      <div className="cart-line__actions">
        <span className="cart-line__label" aria-hidden="true">
          {copy.quantity}
        </span>
        <QuantityControl
          productName={product.name}
          quantity={quantity}
          onChange={onQuantityChange}
        />
        <button
          type="button"
          className="cart-line__remove"
          aria-label={copy.removeLabel(product.name)}
          onClick={onRemove}
        >
          {copy.remove}
        </button>
      </div>
    </li>
  )
}
