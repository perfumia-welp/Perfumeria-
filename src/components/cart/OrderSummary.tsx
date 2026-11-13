import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type Ref,
} from "react"
import { useI18n } from "@/i18n/i18nContext"
import type { BagPromotion } from "@/lib/buy3Promotion"
import { formatPrice } from "@/lib/formatPrice"
import { ORDER_TAX } from "@/lib/orderTax"
import { applyPromoCode } from "@/services/checkout"
import Icon from "../ui/Icon"
import PromotionRows from "./PromotionRows"

/** Kept as a key so the note follows a language switch. */
type PromoMessage = "empty" | "unavailable" | "error"

/**
 * Order summary. Shipping stays "Calculated at checkout" (never estimated
 * here); tax is always zero and shown as such. Promo calls go through
 * services/checkout.ts; the entered code is recorded with the order request
 * but not applied.
 */
interface OrderSummaryProps {
  /** Product subtotal before the Buy 3 promotion. */
  subtotal: number
  /** Buy 3 — Cheapest Item Free on the bag; its total is the bag total. */
  promotion: BagPromotion
  currency: string
  /** Entered promo code, kept in the bag so checkout can record it. */
  promoCode: string
  onPromoCodeChange: (code: string) => void
  onCheckout: () => void
  /** Lets the page know when the checkout button is on screen. */
  checkoutRef?: Ref<HTMLButtonElement>
  /** Minimum-order message, set only after a Checkout attempt below it. */
  minimumMessage?: string
  /** Counts Checkout attempts, so a repeat attempt is announced again. */
  minimumAttempt?: number
}

export default function OrderSummary({
  subtotal,
  promotion,
  currency,
  promoCode,
  onPromoCodeChange,
  onCheckout,
  checkoutRef,
  minimumMessage,
  minimumAttempt,
}: OrderSummaryProps) {
  const panelId = useId()
  // Reopen the panel when returning to the bag with a code already entered.
  const [promoOpen, setPromoOpen] = useState(Boolean(promoCode))
  const [promoMessage, setPromoMessage] = useState<PromoMessage | null>(null)
  const minimumRef = useRef<HTMLDivElement>(null)

  // Each blocked attempt brings the message into view: the button can sit
  // at the bottom edge of the window, with the message just below it.
  const minimumShown = Boolean(minimumMessage)
  useEffect(() => {
    if (!minimumShown || !minimumAttempt) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    minimumRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduce ? "auto" : "smooth",
    })
  }, [minimumShown, minimumAttempt])
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

  const price = (amount: number) => formatPrice(amount, currency, locale)
  const total = price(promotion.total)
  const offerCopy = t.cart.promotion

  return (
    <aside className="order-summary" aria-labelledby={`${panelId}-title`}>
      <h2 id={`${panelId}-title`} className="order-summary__title">
        {copy.title}
      </h2>

      <dl className="order-summary__rows">
        <div>
          <dt>{copy.subtotal}</dt>
          <dd>{price(subtotal)}</dd>
        </div>
        <PromotionRows
          discount={promotion.discount}
          total={promotion.total}
          price={price}
        />
        <div>
          <dt>{copy.shipping}</dt>
          <dd>{copy.calculatedAtCheckout}</dd>
        </div>
        <div>
          <dt>{copy.tax}</dt>
          <dd>{price(ORDER_TAX)}</dd>
        </div>
      </dl>
      {/* One or two units: how many more make the cheapest one free. */}
      {promotion.freeUnits === 0 && promotion.unitCount > 0 && (
        <p className="order-summary__offer">
          {offerCopy.progress(promotion.unitsToNextFree)}
        </p>
      )}

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
        aria-describedby={minimumMessage ? `${panelId}-minimum` : undefined}
        onClick={onCheckout}
      >
        {copy.proceed} <Icon name="arrow" />
      </button>
      {/* Always present (empty until needed) so screen readers announce it;
          a new attempt replaces the paragraph to announce it again. */}
      <div
        ref={minimumRef}
        id={`${panelId}-minimum`}
        className="order-summary__minimum"
        role="alert"
      >
        {minimumMessage && <p key={minimumAttempt}>{minimumMessage}</p>}
      </div>
    </aside>
  )
}
