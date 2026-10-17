import { MAX_QUANTITY, MIN_QUANTITY } from "@/cart/bagContext"
import { useI18n } from "@/i18n/i18nContext"
import "./QuantityControl.css"

/**
 * − 1 + stepper. Limits use aria-disabled (not disabled) so a keyboard user
 * pressing − down to 1 keeps focus on the button.
 */
export default function QuantityControl({
  productName,
  quantity,
  onChange,
}: {
  productName: string
  quantity: number
  onChange: (quantity: number) => void
}) {
  const copy = useI18n().t.common.quantity
  const atMin = quantity <= MIN_QUANTITY
  const atMax = quantity >= MAX_QUANTITY

  return (
    <div
      className="quantity-control"
      role="group"
      aria-label={copy.group(productName)}
    >
      <button
        type="button"
        aria-label={copy.decrease}
        aria-disabled={atMin}
        onClick={() => !atMin && onChange(quantity - 1)}
      >
        −
      </button>
      <span aria-live="polite" aria-atomic="true">
        <span className="visually-hidden">{copy.current}</span>
        {quantity}
      </span>
      <button
        type="button"
        aria-label={copy.increase}
        aria-disabled={atMax}
        onClick={() => !atMax && onChange(quantity + 1)}
      >
        +
      </button>
    </div>
  )
}
