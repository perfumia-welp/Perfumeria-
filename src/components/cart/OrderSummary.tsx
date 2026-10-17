import { useId, useState, type FormEvent, type Ref } from "react"
import { useI18n } from "@/i18n/i18nContext"
import { formatPrice } from "@/lib/formatPrice"
import { applyPromoCode } from "@/services/checkout"
import Icon from "../ui/Icon"

/** Kept as a key so the note follows a language switch. */
type PromoMessage = "empty" | "unavailable" | "error"

/**
 * Order summary. Shipping and tax stay "Calculated at checkout": they are
 * never estimated here. Promo calls go through services/checkout.ts; the
 * entered code is recorded with the order request but not applied.
 */
interface OrderSummaryProps {
  subtotal: number
  currency: string
  /** Entered promo code, kept in the bag so checkout can record it. */
  promoCode: string
  onPromoCodeChange: (code: string) => void
  onCheckout: () => void
  /** Lets the page know when the checkout button is on screen. */
  checkoutRef?: Ref<HTMLButtonElement>
}

export default function OrderSummary({
  subtotal,
  currency,
  promoCode,
  onPromoCodeChange,
  onCheckout,
  checkoutRef,
}: OrderSummaryProps) {
  const panelId = useId()
  // Reopen the panel when returning to the bag with a code already entered.
  const [promoOpen, setPromoOpen] = useState(Boolean(promoCode))
  const [promoMessage, setPromoMessage] = useState<PromoMessage | null>(null)
  const { t, locale } = useI18n()
  const copy = t.cart.summary
  const promoNotes = {
    empty: copy.promoEmpty,
    unavailable: copy.promoUnavailable,
    error: t.common.genericError,
  }

  const submitPromo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!promoCode.trim()) {
      setPromoMessage("empty")
      return
    }
    const result = await applyPromoCode(promoCode.trim())
    setPromoMessage(result.status === "error" ? "error" : "unavailable")
  }

  const total = formatPrice(subtotal, currency, locale)

  return (
    <aside className="order-summary" aria-labelledby={`${panelId}-title`}>
      <h2 id={`${panelId}-title`} className="order-summary__title">
        {copy.title}
      </h2>

      <dl className="order-summary__rows">
        <div>
          <dt>{copy.subtotal}</dt>
          <dd>{total}</dd>
        </div>
        <div>
          <dt>{copy.shipping}</dt>
          <dd>{copy.calculatedAtCheckout}</dd>
        </div>
        <div>
          <dt>{copy.estimatedTax}</dt>
          <dd>{copy.calculatedAtCheckout}</dd>
        </div>
      </dl>

      <div className="order-summary__promo">
        <button
          type="button"
          className="order-summary__promo-toggle"
          aria-expanded={promoOpen}
          aria-controls={panelId}
          onClick={() => setPromoOpen((open) => !open)}
        >
          {copy.promoToggle}
          <span aria-hidden="true">{promoOpen ? "−" : "+"}</span>
        </button>
        <div id={panelId} hidden={!promoOpen}>
          <form
            className="order-summary__promo-form"
            noValidate
            onSubmit={submitPromo}
          >
            <label className="visually-hidden" htmlFor={`${panelId}-code`}>
              {copy.promoLabel}
            </label>
            <input
              id={`${panelId}-code`}
              placeholder={copy.promoPlaceholder}
              autoComplete="off"
              value={promoCode}
              onChange={(event) => {
                onPromoCodeChange(event.target.value)
                setPromoMessage(null)
              }}
            />
            <button type="submit">{copy.apply}</button>
          </form>
          <p className="order-summary__note" role="status">
            {promoMessage && promoNotes[promoMessage]}
          </p>
        </div>
      </div>

      <div className="order-summary__total">
        <span>{copy.total}</span>
        <strong>{total}</strong>
      </div>
      <p className="order-summary__fineprint">{copy.fineprint}</p>

      <button
        ref={checkoutRef}
        type="button"
        className="order-summary__checkout"
        onClick={onCheckout}
      >
        {copy.proceed} <Icon name="arrow" />
      </button>
    </aside>
  )
}
