import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useParams } from "react-router"
import { useAuth } from "@/auth/authContext"
import { MAX_QUANTITY } from "@/cart/bagContext"
import QuantityControl from "@/components/cart/QuantityControl"
import CheckoutConfirmation, {
  type EmailState,
} from "@/components/checkout/CheckoutConfirmation"
import CheckoutSummary from "@/components/checkout/CheckoutSummary"
import OrderDetailsFields from "@/components/checkout/OrderDetailsFields"
import OrderAddProduct from "@/components/checkout/OrderAddProduct"
import QuoteNotice from "@/components/checkout/QuoteNotice"
import AppLink from "@/components/ui/AppLink"
import Container from "@/components/ui/Container"
import Icon from "@/components/ui/Icon"
import PageIntro from "@/components/ui/PageIntro"
import { whatsappDigits } from "@/config/company"
import { useCatalogState } from "@/hooks/useCatalogState"
import { useOrderRules } from "@/hooks/useOrderRules"
import { useValidatedForm } from "@/hooks/useValidatedForm"
import { useI18n } from "@/i18n/i18nContext"
import type { Locale } from "@/i18n/locales"
import { bagPromotion } from "@/lib/buy4Promotion"
import { formatPrice } from "@/lib/formatPrice"
import { minimumOrderShortfall } from "@/lib/minimumOrder"
import { validateOrderDetails, type OrderDetailsField } from "@/lib/orderDetails"
import { hasOrderChanges, orderDetails } from "@/lib/orderEdit"
import { orderErrorMessage } from "@/lib/orderErrors"
import { orderLineName, type CheckoutDetails } from "@/lib/orderRequest"
import { readOrderSession, writeOrderSession } from "@/lib/orderSession"
import { ORDER_TAX } from "@/lib/orderTax"
import { paths } from "@/router/paths"
import { getCatalog } from "@/services/catalog"
import { fetchOrder, submitOrder } from "@/services/orders"
import type { Product } from "@/types/catalog"
import type { CartItem } from "@/types/commerce"
import type { OrderLine, OrderRequest } from "@/types/order"
import "./CartPage.css"
import "./AuthPage.css"
import "./CheckoutPage.css"

/** A line of the order being edited: the stored line and its new quantity. */
interface DraftLine {
  line: OrderLine
  quantity: number
}

/** Catalogue products by company id: pictures, and whether a line is a Perfume Box. */
function useCatalogueByCompanyId(locale: Locale) {
  const { version } = useCatalogState()
  return useMemo(() => {
    void version
    const byId = new Map<number, Product>()
    for (const product of getCatalog(locale))
      if (product.productId) byId.set(product.productId, product)
    return byId
  }, [locale, version])
}

/**
 * A stored line as the summary panel shows it: the server's name and price,
 * the catalogue's picture when it is loaded (else the stored image).
 */
function summaryItem(
  line: OrderLine,
  quantity: number,
  currency: string,
  catalogue: Map<number, Product>,
  locale: Locale,
): CartItem {
  const product = line.welpProductId ? catalogue.get(line.welpProductId) : undefined
  return {
    quantity,
    product: {
      ...(product ?? { slug: "", notes: [], inStock: true }),
      id: line.productId,
      name: orderLineName(line, locale),
      price: line.unitPrice,
      currency,
      size: product?.size,
      giftSet: product?.giftSet,
      packshot: product?.packshot ?? { src: line.imageUrl ?? "", alt: "" },
    } as Product,
  }
}

const freeMap = (order: OrderRequest) =>
  new Map(
    order.lines
      .filter((line) => line.freeQuantity)
      .map((line) => [line.productId, line.freeQuantity ?? 0]),
  )

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "failed" }
  | { status: "ready"; order: OrderRequest; emailState: EmailState }

/*
 * One stored order: its confirmation, and "Edit Details", which edits the
 * order itself (lines, quantities, details), never the shopping bag. Shown
 * from this tab's copy at once (lib/orderSession), then from the server's
 * record (GET /api/orders/:reference), which only the order's owner (guest
 * or account) can read. Saving sends the whole order again under the same
 * reference: the server re-verifies prices, the promotion, the minimum and
 * the contact details, and emails the team what changed.
 */
export default function OrderPage() {
  const { reference = "" } = useParams()
  const { bagOwnerId, isLoading: authLoading } = useAuth()
  const { t } = useI18n()
  const copy = t.checkout
  const [state, setState] = useState<LoadState>(() => {
    const cached = readOrderSession(reference)
    return cached
      ? { status: "ready", order: cached.order, emailState: cached.emailState }
      : { status: "loading" }
  })
  const [editing, setEditing] = useState(false)
  const [sendError, setSendError] = useState("")

  const load = useCallback(async () => {
    if (!bagOwnerId) {
      setState({ status: "missing" })
      return
    }
    const cached = readOrderSession(reference)
    const mine = cached?.owner === bagOwnerId ? cached : null
    if (!mine) setState({ status: "loading" })
    const result = await fetchOrder(reference)
    if (result.ok && result.order) {
      const server = result.order
      // Same version as this tab's copy: keep its finer email state
      // (e.g. "unchanged"); a newer server version wins outright.
      const emailState =
        mine && (mine.order.revision ?? 1) === (server.revision ?? 1)
          ? mine.emailState
          : (result.emailState ?? "error")
      writeOrderSession({ owner: bagOwnerId, order: server, emailState })
      setState((current) =>
        current.status === "ready" &&
        (current.order.revision ?? 1) > (server.revision ?? 1)
          ? current
          : { status: "ready", order: server, emailState },
      )
      return
    }
    if (mine) {
      // The server could not be asked: this tab's copy is still the order.
      setState({ status: "ready", order: mine.order, emailState: mine.emailState })
      return
    }
    setState({
      status:
        result.error === "not_found" || result.error === "session_expired"
          ? "missing"
          : "failed",
    })
  }, [bagOwnerId, reference])

  // Once the visitor's identity is known; not while an edit is open.
  const loaded = useRef<string | null>(null)
  useEffect(() => {
    if (authLoading || editing) return
    const key = `${bagOwnerId}:${reference}`
    if (loaded.current === key) return
    loaded.current = key
    void load()
  }, [authLoading, bagOwnerId, reference, editing, load])

  if (state.status === "loading")
    return (
      <Container as="section" className="empty-cart page-pending">
        <p className="empty-cart__lead" role="status">
          {copy.orderPage.loading}
        </p>
      </Container>
    )

  if (state.status !== "ready")
    return (
      <Container as="section" className="empty-cart">
        <h1>{copy.orderPage.missingTitle}</h1>
        <p className="empty-cart__lead" role="alert">
          {state.status === "missing" ? copy.orderPage.missing : copy.orderPage.failed}
        </p>
        <div className="checkout-confirmation__actions">
          {state.status === "failed" && (
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                loaded.current = null
                setState({ status: "loading" })
                void load()
              }}
            >
              {copy.orderPage.retry}
            </button>
          )}
          <AppLink className="checkout-link" href={paths.contact}>
            {copy.confirmation.whatsapp.unavailableLink}
          </AppLink>
        </div>
      </Container>
    )

  const { order, emailState } = state

  const stored = (next: OrderRequest, nextState: EmailState) => {
    if (bagOwnerId) writeOrderSession({ owner: bagOwnerId, order: next, emailState: nextState })
    setState({ status: "ready", order: next, emailState: nextState })
  }

  /** "Save Changes" stored the edit; this sends it to the team now. */
  const sendSaved = async () => {
    setSendError("")
    setState({ status: "ready", order, emailState: "sending" })
    const result = await submitOrder({ ...order, notify: true })
    if (result.ok && result.order) {
      stored(result.order, result.emailState ?? "error")
      return
    }
    setState({ status: "ready", order, emailState: "saved" })
    setSendError(orderErrorMessage(t, result.error, undefined))
  }

  return (
    <div className="checkout-page">
      <PageIntro intro={copy.intro} />
      {editing ? (
        <OrderEditor
          key={`${order.reference}:${order.revision ?? 1}`}
          order={order}
          onCancel={() => setEditing(false)}
          onSaved={(next, nextState) => {
            stored(next, nextState)
            setEditing(false)
            window.scrollTo({ top: 0 })
          }}
        />
      ) : (
        <OrderView
          order={order}
          emailState={emailState}
          onEdit={() => {
            setSendError("")
            setEditing(true)
            window.scrollTo({ top: 0 })
          }}
          onSend={sendSaved}
          sendError={emailState === "saved" ? sendError : ""}
        />
      )}
    </div>
  )
}

/** The stored order: confirmation beside its summary (the server's lines and totals). */
function OrderView({
  order,
  emailState,
  onEdit,
  onSend,
  sendError,
}: {
  order: OrderRequest
  emailState: EmailState
  onEdit: () => void
  onSend: () => void
  sendError: string
}) {
  const { t, locale } = useI18n()
  const catalogue = useCatalogueByCompanyId(locale)
  return (
    <Container className="checkout-layout">
      <section className="checkout-main" aria-label={t.checkout.detailsLabel}>
        <CheckoutConfirmation
          order={order}
          emailState={emailState}
          onEdit={onEdit}
          onSend={onSend}
          sendError={sendError}
        />
      </section>
      <CheckoutSummary
        items={order.lines.map((line) =>
          summaryItem(line, line.quantity, order.currency, catalogue, locale),
        )}
        subtotal={order.subtotal}
        discount={order.promotion?.discount ?? 0}
        total={order.displayedTotal}
        freeByLine={freeMap(order)}
        currency={order.currency}
        gift={{ isGift: order.gift !== null, message: order.gift?.message ?? "" }}
        promoCode={order.promo?.code ?? ""}
        showEditBag={false}
      />
    </Container>
  )
}

/**
 * Editing the stored order: its own lines (quantity, remove, Add a Product),
 * details, gift message and promo code.
 * The shopping bag is neither read nor changed. Save & Send emails the team
 * the changes; Save Changes stores them without emailing yet.
 */
function OrderEditor({
  order,
  onCancel,
  onSaved,
}: {
  order: OrderRequest
  onCancel: () => void
  onSaved: (order: OrderRequest, emailState: EmailState) => void
}) {
  const { t, locale } = useI18n()
  const copy = t.checkout
  const catalogue = useCatalogueByCompanyId(locale)
  const { state: rules } = useOrderRules()
  const form = useValidatedForm<OrderDetailsField>(
    orderDetails(order),
    validateOrderDetails,
    (t) => t.checkout.invalid,
    // Editing stored details: a field made invalid says so at once.
    { live: true },
  )
  const [lines, setLines] = useState<DraftLine[]>(() =>
    order.lines.map((line) => ({ line, quantity: line.quantity })),
  )
  const [quote, setQuote] = useState<OrderRequest | null>(null)
  const [gift, setGift] = useState(() => ({
    isGift: order.gift !== null,
    message: order.gift?.message ?? "",
  }))
  const [promoCode, setPromoCode] = useState(order.promo?.code ?? "")
  const giftId = useId()
  /** Which action submitted the form: Save & Send (true) or Save Changes. */
  const notify = useRef(true)

  // Buy 3, Get the 4th Free on the edited lines, as the server will work it
  // out (Perfume Boxes, known from the catalogue, never count). The server's
  // own result is the authority: a difference comes back as a quote.
  const promotion = bagPromotion(
    lines.map(({ line, quantity }) => ({
      id: line.productId,
      unitPrice: line.unitPrice,
      quantity,
      eligible:
        (line.welpProductId ? catalogue.get(line.welpProductId)?.giftSet : false) !== true,
    })),
  )

  const dirty = hasOrderChanges(order, {
    details: form.values,
    lines: lines.map(({ line, quantity }) => ({ productId: line.productId, quantity })),
    gift,
    promoCode,
  })

  const minimum = rules.status === "ready" ? rules.rules.minimumOrderSubtotal : null
  const shortfall = minimum === null ? 0 : minimumOrderShortfall(promotion.total, minimum)
  const price = (amount: number) => formatPrice(amount, order.currency, locale)

  /*
   * A field with an error, or an order under the minimum, pauses both save
   * actions: they look disabled and a note right above them says why (each
   * field name focuses its field). Pressing one anyway checks the form,
   * shows every error and moves to the first invalid field; nothing is sent.
   */
  const invalidFields = form.invalidFields
  const blocked = invalidFields.length > 0 || shortfall > 0

  const setQuantity = (productId: string, quantity: number) =>
    setLines((current) =>
      current.map((entry) =>
        entry.line.productId === productId
          ? { ...entry, quantity: Math.max(1, Math.min(MAX_QUANTITY, quantity)) }
          : entry,
      ),
    )
  /** A product from Add a Product: a new line, or one more of a line already there. */
  const addLine = (added: OrderLine) =>
    setLines((current) =>
      current.some((entry) => entry.line.productId === added.productId)
        ? current.map((entry) =>
            entry.line.productId === added.productId
              ? { ...entry, quantity: Math.min(MAX_QUANTITY, entry.quantity + 1) }
              : entry,
          )
        : [...current, { line: added, quantity: 1 }],
    )
  const remove = (productId: string) =>
    setLines((current) =>
      current.length > 1
        ? current.filter((entry) => entry.line.productId !== productId)
        : current,
    )

  const submit = form.onSubmit(async (values: CheckoutDetails) => {
    if (shortfall > 0) return
    const request: OrderRequest = {
      reference: order.reference,
      createdAt: new Date().toISOString(),
      status: "requested",
      locale,
      customer: {
        fullName: values.fullName.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        userId: order.customer.userId,
      },
      delivery: { address: values.address.trim(), cityArea: values.cityArea.trim() },
      notes: values.notes.trim() || null,
      lines: lines.map(({ line, quantity }) => ({
        welpProductId: line.welpProductId,
        options: (line.options ?? []).map(({ variationId, optionId }) => ({
          variationId,
          optionId,
        })),
        productId: line.productId,
        name: line.name,
        size: line.size,
        quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.unitPrice * quantity,
        imageUrl: line.imageUrl,
      })),
      currency: order.currency,
      subtotal: promotion.subtotal,
      displayedTotal: promotion.total,
      gift: gift.isGift ? { message: gift.message.trim() } : null,
      promo: promoCode.trim()
        ? { code: promoCode.trim(), status: "entered-not-applied" }
        : null,
      shipping: null,
      tax: ORDER_TAX,
      payment: null,
      notify: notify.current,
    }
    const result = await submitOrder(request)
    if (result.ok && result.order) {
      onSaved(result.order, result.emailState ?? "error")
      return
    }
    if (result.error === "price_changed" && result.order) {
      // The catalogue changed: show the server's prices and use them next time.
      const prices = new Map(result.order.lines.map((line) => [line.productId, line.unitPrice]))
      setLines((current) =>
        current.map((entry) => ({
          ...entry,
          line: { ...entry.line, unitPrice: prices.get(entry.line.productId) ?? entry.line.unitPrice },
        })),
      )
      setQuote(result.order)
      form.setStatus({ tone: "error", message: (t) => t.checkout.errors.priceChanged })
      return
    }
    setQuote(null)
    if (result.error === "invalid_contact" && result.field) {
      form.showFieldError(
        result.field,
        result.field === "phone" ? "checkoutPhoneInvalid" : "checkoutEmailInvalid",
      )
      return
    }
    if (
      result.error === "minimum_order_not_met" &&
      typeof result.minimum === "number" &&
      typeof result.subtotal === "number"
    ) {
      const { minimum: min, subtotal } = result
      form.setStatus({
        tone: "error",
        message: (t) =>
          t.checkout.edit.belowMinimum(
            formatPrice(min, order.currency, locale),
            formatPrice(minimumOrderShortfall(subtotal, min), order.currency, locale),
          ),
      })
      return
    }
    const unavailableName = locale === "ar" ? (result.nameAr ?? result.name) : result.name
    form.setStatus({
      tone: "error",
      message: (t) => orderErrorMessage(t, result.error, unavailableName),
    })
  })

  const blockedId = `${form.baseId}-blocked`
  return (
    <Container className="checkout-layout">
      <section className="checkout-main" aria-label={copy.detailsLabel}>
        <form
          ref={form.formRef}
          className="checkout-form order-edit"
          noValidate
          onSubmit={submit}
          aria-describedby={`${form.baseId}-status`}
        >
          <p className="checkout-form__required-note">{copy.requiredNote}</p>

          <fieldset className="order-edit__items">
            <legend>{copy.edit.itemsLegend}</legend>
            <ul className="order-edit__lines">
              {lines.map(({ line, quantity }) => {
                const name = orderLineName(line, locale)
                return (
                  <li key={line.productId} className="order-edit__line" data-product-id={line.productId}>
                    <div className="order-edit__line-text">
                      <p className="order-edit__line-name">{name}</p>
                      <p className="order-edit__line-price">
                        {quantity} × {price(line.unitPrice)}
                      </p>
                    </div>
                    <QuantityControl
                      productName={name}
                      quantity={quantity}
                      onChange={(next) => setQuantity(line.productId, next)}
                    />
                    <button
                      type="button"
                      className="checkout-link order-edit__remove"
                      aria-label={copy.edit.removeLabel(name)}
                      aria-disabled={lines.length === 1}
                      aria-describedby={lines.length === 1 ? `${form.baseId}-last` : undefined}
                      onClick={() => remove(line.productId)}
                    >
                      {copy.edit.remove}
                    </button>
                  </li>
                )
              })}
            </ul>
            {lines.length === 1 && (
              <p id={`${form.baseId}-last`} className="checkout-edit__hint">
                {copy.edit.lastItem}
              </p>
            )}
            <OrderAddProduct onAdd={addLine} />
          </fieldset>

          <OrderDetailsFields form={form} />

          <fieldset className="order-edit__extras">
            <legend>{copy.edit.extrasLegend}</legend>
            <div className="gift-option checkout-form__wide">
              <label className="gift-option__toggle">
                <input
                  type="checkbox"
                  name="isGift"
                  checked={gift.isGift}
                  aria-controls={`${giftId}-message`}
                  onChange={(event) => setGift({ ...gift, isGift: event.target.checked })}
                />
                <span>{t.cart.gift.toggle}</span>
              </label>
              {gift.isGift && (
                <div className="gift-option__message">
                  <label className="visually-hidden" htmlFor={`${giftId}-message`}>
                    {t.cart.gift.label}
                  </label>
                  <textarea
                    id={`${giftId}-message`}
                    name="giftMessage"
                    placeholder={t.cart.gift.placeholder}
                    maxLength={250}
                    rows={2}
                    value={gift.message}
                    onChange={(event) => setGift({ ...gift, message: event.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="form-field checkout-form__wide">
              <label htmlFor={`${giftId}-promo`}>
                {t.cart.summary.promoLabel}
                <span className="form-field__optional">{t.common.optional}</span>
              </label>
              <input
                id={`${giftId}-promo`}
                name="promoCode"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={40}
                value={promoCode}
                aria-describedby={`${giftId}-promo-hint`}
                onChange={(event) => setPromoCode(event.target.value)}
              />
              <p id={`${giftId}-promo-hint`} className="checkout-edit__hint order-edit__promo-hint">
                {copy.edit.promoHint}
              </p>
            </div>
          </fieldset>

          <div className="auth-form__submit">
            {quote && <QuoteNotice order={quote} />}
            {!dirty && !blocked ? (
              // Nothing differs from the stored order: nothing to save or send.
              <div className="checkout-edit">
                <p className="checkout-edit__note">{copy.edit.noChanges}</p>
                <button type="button" className="checkout-link" onClick={onCancel}>
                  {copy.edit.backToOrder}
                </button>
              </div>
            ) : (
              <>
                {blocked && (
                  <div className="checkout-edit__blocked" id={blockedId} role="alert">
                    {invalidFields.length > 0 && (
                      <>
                        <p>{copy.edit.blocked(invalidFields.length)}</p>
                        <ul>
                          {invalidFields.map((field) => (
                            <li key={field}>
                              <button type="button" onClick={() => form.focusField(field)}>
                                {copy.fields[field]}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {shortfall > 0 && minimum !== null && (
                      <p>{copy.edit.belowMinimum(price(minimum), price(shortfall))}</p>
                    )}
                  </div>
                )}
                <button
                  type="submit"
                  className="button-primary"
                  aria-disabled={blocked || form.submitting}
                  aria-describedby={blocked ? blockedId : undefined}
                  disabled={form.submitting}
                  onClick={() => (notify.current = true)}
                >
                  {form.submitting
                    ? copy.submitting
                    : quote
                      ? copy.quote.confirm
                      : copy.edit.saveAndSend}{" "}
                  <Icon name="arrow" />
                </button>
                <div className="checkout-edit">
                  <button
                    type="submit"
                    className="checkout-link"
                    aria-disabled={blocked || form.submitting}
                    aria-describedby={blocked ? blockedId : undefined}
                    disabled={form.submitting}
                    onClick={() => (notify.current = false)}
                  >
                    {copy.edit.save}
                  </button>
                  <p className="checkout-edit__hint">{copy.edit.saveHint}</p>
                  <button type="button" className="checkout-link" onClick={onCancel}>
                    {copy.edit.backToOrder}
                  </button>
                </div>
              </>
            )}
            <p
              id={`${form.baseId}-status`}
              className={`auth-status${form.status?.tone === "error" ? " is-error" : ""}`}
              role="status"
            >
              {form.statusText}
            </p>
          </div>
          <p className="checkout-form__fineprint">
            {copy.fineprint(Boolean(whatsappDigits))}
          </p>
        </form>
      </section>

      <CheckoutSummary
        items={lines.map(({ line, quantity }) =>
          summaryItem(line, quantity, order.currency, catalogue, locale),
        )}
        subtotal={promotion.subtotal}
        discount={promotion.discount}
        total={promotion.total}
        freeByLine={promotion.freeByLine}
        currency={order.currency}
        gift={gift}
        promoCode={promoCode}
        showEditBag={false}
      />
    </Container>
  )
}
