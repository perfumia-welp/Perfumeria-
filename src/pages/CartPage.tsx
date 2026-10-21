import { useEffect, useId, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { useBag, type UnavailableBagLine } from "@/cart/bagContext"
import CartLine from "@/components/cart/CartLine"
import OrderSummary from "@/components/cart/OrderSummary"
import AppLink from "@/components/ui/AppLink"
import Container from "@/components/ui/Container"
import Icon from "@/components/ui/Icon"
import PageIntro from "@/components/ui/PageIntro"
import { useI18n } from "@/i18n/i18nContext"
import { formatPrice } from "@/lib/formatPrice"
import { paths } from "@/router/paths"
import "./CartPage.css"

export default function CartPage() {
  const bag = useBag()
  const {
    items,
    unavailableItems,
    isReady,
    itemCount,
    subtotal,
    lastRemoved,
    clearRemoved,
    gift,
  } = bag
  const giftId = useId()
  const navigate = useNavigate()
  const { t, locale, localize } = useI18n()
  const copy = t.cart

  const [summaryVisible, setSummaryVisible] = useState(false)

  const undoRef = useRef<HTMLButtonElement>(null)
  const checkoutRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const restoredId = useRef<string | null>(null)

  // The Undo offer expires when the visitor leaves the bag.
  useEffect(() => clearRemoved, [clearRemoved])

  // After a removal, keep keyboard focus on the Undo button…
  useEffect(() => {
    if (lastRemoved) undoRef.current?.focus()
  }, [lastRemoved])

  // …and after Undo, return it to the restored line.
  useEffect(() => {
    const id = restoredId.current
    if (!id) return
    restoredId.current = null
    listRef.current
      ?.querySelector<HTMLElement>(
        `[data-product-id="${id}"] .cart-line__remove`,
      )
      ?.focus()
  }, [items])

  // Hide the mobile checkout bar while the summary's own button is on screen.
  useEffect(() => {
    const button = checkoutRef.current
    if (!button) return
    const observer = new IntersectionObserver(([entry]) =>
      setSummaryVisible(entry.isIntersecting),
    )
    observer.observe(button)
    return () => observer.disconnect()
  }, [items.length > 0])

  const undo = () => {
    restoredId.current = lastRemoved?.product.id ?? null
    bag.undoRemove()
  }

  const checkout = () => navigate(localize(paths.checkout))

  const undoNotice = lastRemoved && (
    <div className="cart-undo" role="status">
      <span>{copy.removed(lastRemoved.product.name)}</span>
      <button ref={undoRef} type="button" onClick={undo}>
        {copy.undo}
      </button>
    </div>
  )

  const unavailableLines = unavailableItems.map((line) => (
    <UnavailableLine
      key={line.id}
      line={line}
      onRemove={() => bag.removeItem(line.id)}
    />
  ))

  if (items.length === 0 && unavailableItems.length === 0 && !isReady) {
    return (
      <Container as="section" className="empty-cart">
        <p className="empty-cart__lead" role="status">
          {copy.loading}
        </p>
      </Container>
    )
  }

  if (items.length === 0) {
    return (
      <Container
        as="section"
        className="empty-cart"
        aria-labelledby="empty-cart-title"
      >
        {undoNotice}
        {unavailableLines.length > 0 && (
          <ul className="cart-items__list">{unavailableLines}</ul>
        )}
        <p className="eyebrow">{copy.empty.eyebrow}</p>
        <h1 id="empty-cart-title">
          {/* The space keeps the two lines apart for screen readers ("scent is"). */}
          {copy.empty.title[0]} <br />
          {copy.empty.title[1]}
        </h1>
        <p className="empty-cart__lead">{copy.empty.lead}</p>
        <AppLink className="button-primary" href={paths.products}>
          {copy.empty.action} <Icon name="arrow" />
        </AppLink>
      </Container>
    )
  }

  const currency = items[0].product.currency

  return (
    <div className="cart-page">
      <PageIntro intro={copy.intro} meta={copy.itemCount(itemCount)}>
        <AppLink className="cart-back" href={paths.products}>
          <Icon name="arrow" /> {copy.continueShopping}
        </AppLink>
      </PageIntro>

      <Container className="cart-layout">
        <section className="cart-items" aria-label={copy.itemsLabel}>
          {undoNotice}
          <ul ref={listRef} className="cart-items__list">
            {items.map((item) => (
              <CartLine
                key={item.product.id}
                item={item}
                onQuantityChange={(quantity) =>
                  bag.setQuantity(item.product.id, quantity)
                }
                onRemove={() => bag.removeItem(item.product.id)}
              />
            ))}
            {unavailableLines}
          </ul>

          <div className="gift-option">
            <label className="gift-option__toggle">
              <input
                type="checkbox"
                checked={gift.isGift}
                aria-controls={`${giftId}-message`}
                onChange={(event) =>
                  bag.setGift({ ...gift, isGift: event.target.checked })
                }
              />
              <span>{copy.gift.toggle}</span>
            </label>
            {gift.isGift && (
              <div className="gift-option__message">
                <label
                  className="visually-hidden"
                  htmlFor={`${giftId}-message`}
                >
                  {copy.gift.label}
                </label>
                <textarea
                  id={`${giftId}-message`}
                  placeholder={copy.gift.placeholder}
                  maxLength={250}
                  rows={2}
                  value={gift.message}
                  onChange={(event) =>
                    bag.setGift({ ...gift, message: event.target.value })
                  }
                />
              </div>
            )}
          </div>
        </section>

        <OrderSummary
          subtotal={subtotal}
          currency={currency}
          promoCode={bag.promoCode}
          onPromoCodeChange={bag.setPromoCode}
          onCheckout={checkout}
          checkoutRef={checkoutRef}
        />
      </Container>

      {/* Mobile only (CSS): a sticky total and checkout while browsing the bag. */}
      <div
        className={`mobile-checkout${summaryVisible ? " is-hidden" : ""}`}
        aria-hidden={summaryVisible}
      >
        <div className="mobile-checkout__bar">
          <span>
            {copy.mobileBar.total}{" "}
            <strong>{formatPrice(subtotal, currency, locale)}</strong>
          </span>
          <button
            type="button"
            tabIndex={summaryVisible ? -1 : undefined}
            onClick={checkout}
          >
            {copy.mobileBar.checkout} <Icon name="arrow" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** A saved line that can no longer be ordered: its name, why, and Remove. */
function UnavailableLine({
  line,
  onRemove,
}: {
  line: UnavailableBagLine
  onRemove: () => void
}) {
  const { t } = useI18n()
  const copy = t.cart
  const name = line.name ?? copy.unavailable.name
  return (
    <li className="cart-line" data-product-id={line.id} data-unavailable="">
      <div className="cart-line__image" />
      <div className="cart-line__details">
        <h2>{name}</h2>
        <p>{copy.unavailable.note}</p>
      </div>
      <div className="cart-line__actions">
        <button
          type="button"
          className="cart-line__remove"
          aria-label={copy.line.removeLabel(name)}
          onClick={onRemove}
        >
          {copy.line.remove}
        </button>
      </div>
    </li>
  )
}
