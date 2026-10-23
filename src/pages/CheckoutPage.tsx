import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { useAuth, userNames } from "@/auth/authContext"
import { useBag } from "@/cart/bagContext"
import CheckoutConfirmation, {
  type EmailState,
} from "@/components/checkout/CheckoutConfirmation"
import CheckoutSummary from "@/components/checkout/CheckoutSummary"
import AppLink from "@/components/ui/AppLink"
import Container from "@/components/ui/Container"
import FormField from "@/components/ui/FormField"
import Icon from "@/components/ui/Icon"
import PageIntro from "@/components/ui/PageIntro"
import PendingRedirect from "@/components/ui/PendingRedirect"
import { whatsappDigits } from "@/config/company"
import { useValidatedForm, type ValidationKey } from "@/hooks/useValidatedForm"
import { useI18n } from "@/i18n/i18nContext"
import type { Messages } from "@/i18n/messages"
import { formatPrice } from "@/lib/formatPrice"
import {
  buildOrderRequest,
  orderLineName,
  type CheckoutDetails,
} from "@/lib/orderRequest"
import { isValidEmail, isValidPhone } from "@/lib/validation"
import { paths } from "@/router/paths"
import { getProfile, listAddresses } from "@/services/account"
import { submitOrder, type OrderErrorCode } from "@/services/orders"
import type { OrderRequest } from "@/types/order"
import "./CartPage.css"
import "./AuthPage.css"
import "./CheckoutPage.css"

type Field = keyof CheckoutDetails

const EMPTY: CheckoutDetails = {
  fullName: "",
  phone: "",
  email: "",
  address: "",
  cityArea: "",
  notes: "",
}

function validate(values: CheckoutDetails) {
  const errors: Partial<Record<Field, ValidationKey>> = {}
  if (!values.fullName.trim()) errors.fullName = "fullNameRequired"
  if (!values.phone.trim()) errors.phone = "phoneRequired"
  else if (!isValidPhone(values.phone)) errors.phone = "phoneInvalid"
  if (!values.email.trim()) errors.email = "emailRequired"
  else if (!isValidEmail(values.email)) errors.email = "emailInvalid"
  if (!values.address.trim()) errors.address = "addressRequired"
  if (!values.cityArea.trim()) errors.cityArea = "cityAreaRequired"
  return errors
}

/** The server's corrected prices, for the bag they were quoted for. */
interface Quote {
  order: OrderRequest
  signature: string
}

/** The browser tab's order reference for one bag owner (guest or account). */
const referenceStorageKey = (owner: string) =>
  `perfumira:checkout-reference:${owner}`

/** What to tell the customer when /api/orders did not accept the order. */
function orderErrorMessage(
  t: Messages,
  error: OrderErrorCode | undefined,
  unavailableName: string | undefined,
) {
  const errors = t.checkout.errors
  switch (error) {
    case "unavailable_product":
      return unavailableName
        ? errors.unavailable(unavailableName)
        : errors.unavailableUnnamed
    case "invalid_order":
    case "invalid_product":
    case "invalid_option":
    case "option_required":
    case "duplicate_line":
      return errors.invalidItems
    case "rate_limited":
      return errors.rateLimited
    case "session_expired":
      return errors.sessionExpired
    case "order_locked":
      return errors.locked
    default:
      return errors.failed
  }
}

/*
 * Checkout: an order request, not a payment. The server (/api/orders)
 * checks it against the company catalogue and stores it; only then does the
 * confirmation show, with the stored order's prices. The server emails the
 * store, and the customer can also send the stored order as a prefilled
 * WhatsApp message; the store then confirms the order personally. Signing
 * in is optional: it prefills the form from the account (profile, email and
 * default address) and shows the order in the account's history.
 *
 * One reference per checkout visit: "Edit Details" and submitting again
 * reuses it, so the WhatsApp message, the email and the history record all
 * describe the same request (the server stores it as an updated order).
 */
export default function CheckoutPage() {
  const bag = useBag()
  const { user, bagOwnerId, startGuestSession } = useAuth()
  const navigate = useNavigate()
  const { t, locale, localize } = useI18n()
  const copy = t.checkout
  const form = useValidatedForm<Field>(EMPTY, validate)
  const [order, setOrder] = useState<OrderRequest | null>(null)
  const [emailState, setEmailState] = useState<EmailState>("sending")
  const [finishing, setFinishing] = useState(false)
  const reference = useRef<string | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  // A different bag owner (sign-in, sign-out, a new guest) starts over.
  useEffect(() => {
    setOrder(null)
    setQuote(null)
    reference.current = null
  }, [bagOwnerId])

  // Prefill only fills empty fields the customer has not typed in, so a
  // late answer never overwrites their input. Guests are not looked up.
  const { prefill } = form
  useEffect(() => {
    if (!user) return
    prefill({ email: user.email ?? "" })
    let current = true
    void Promise.all([getProfile(user.id), listAddresses()]).then(
      ([profile, addresses]) => {
        if (!current) return
        const saved = profile.ok ? profile.data : null
        const savedName = saved
          ? `${saved.firstName} ${saved.lastName}`.trim()
          : ""
        const home = addresses.ok
          ? addresses.data.find((address) => address.isDefault)
          : undefined
        prefill({
          fullName: savedName || userNames(user).fullName,
          phone: saved?.phone ?? "",
          address: home?.address ?? "",
          cityArea: home?.cityArea ?? "",
        })
      },
    )
    return () => {
      current = false
    }
  }, [user, prefill])

  // The saved bag (or its products) may still be loading after a refresh.
  if (bag.items.length === 0 && !bag.isReady && !finishing) {
    return (
      <Container as="section" className="empty-cart page-pending">
        <p className="empty-cart__lead" role="status">
          {t.cart.loading}
        </p>
      </Container>
    )
  }

  if (bag.items.length === 0) {
    return finishing ? (
      <div className="page-pending" />
    ) : (
      <PendingRedirect to={localize(paths.cart)} replace />
    )
  }

  const currency = bag.items[0].product.currency

  const submit = form.onSubmit(async (values) => {
    const owner = bagOwnerId ?? (await startGuestSession())
    if (!owner) {
      form.setStatus({ tone: "error", message: (t) => t.checkout.errors.session })
      return
    }
    const referenceKey = referenceStorageKey(owner)
    try {
      reference.current ??= sessionStorage.getItem(referenceKey)
    } catch {
      /* Storage may be disabled. */
    }
    const request = buildOrderRequest({
      details: values,
      items: bag.items,
      gift: bag.gift,
      promoCode: bag.promoCode,
      userId: user?.id ?? null,
      locale,
      reference: reference.current ?? undefined,
    })
    reference.current = request.reference
    try {
      sessionStorage.setItem(referenceKey, request.reference)
    } catch {
      /* The server still turns a repeat into the same order. */
    }
    // A confirmed quote replaces the bag's prices only while the bag itself
    // is unchanged; any change asks the server for a new quote.
    const signature = JSON.stringify(
      request.lines.map((line) => [line.productId, line.quantity, line.unitPrice]),
    )
    if (quote?.signature === signature) {
      request.lines = quote.order.lines
      request.currency = quote.order.currency
      request.subtotal = quote.order.subtotal
      request.displayedTotal = quote.order.displayedTotal
    }
    const result = await submitOrder(request)
    if (result.ok && result.order) {
      setOrder(result.order)
      setQuote(null)
      setEmailState(result.emailState ?? "error")
      return
    }
    if (result.error === "price_changed" && result.order) {
      setQuote({ order: result.order, signature })
      form.setStatus({ tone: "error", message: (t) => t.checkout.errors.priceChanged })
      return
    }
    setQuote(null)
    const unavailableName = locale === "ar" ? (result.nameAr ?? result.name) : result.name
    form.setStatus({
      tone: "error",
      message: (t) => orderErrorMessage(t, result.error, unavailableName),
    })
  })

  // `finishing` stops the empty-bag redirect to /cart from overriding this
  // navigation (the router applies its update as a transition, after ours).
  const done = () => {
    try {
      if (bagOwnerId) sessionStorage.removeItem(referenceStorageKey(bagOwnerId))
    } catch {
      /* Optional storage. */
    }
    setFinishing(true)
    bag.clearBag()
    navigate(localize(paths.home), { replace: true })
  }

  return (
    <div className="checkout-page">
      <PageIntro intro={copy.intro}>
        <AppLink className="cart-back" href={paths.cart}>
          <Icon name="arrow" /> {copy.backToBag}
        </AppLink>
      </PageIntro>

      <Container className="checkout-layout">
        <section className="checkout-main" aria-label={copy.detailsLabel}>
          {order ? (
            <CheckoutConfirmation
              order={order}
              emailState={emailState}
              onEdit={() => setOrder(null)}
              onDone={done}
            />
          ) : (
            <form
              ref={form.formRef}
              className="checkout-form"
              noValidate
              onSubmit={submit}
              aria-describedby={`${form.baseId}-status`}
            >
              <fieldset>
                <legend>{copy.legends.details}</legend>
                <FormField
                  label={copy.fields.fullName}
                  autoComplete="name"
                  maxLength={120}
                  className="checkout-form__wide"
                  {...form.fieldProps("fullName")}
                />
                <FormField
                  label={copy.fields.phone}
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  {...form.fieldProps("phone")}
                />
                <FormField
                  label={copy.fields.email}
                  type="email"
                  autoComplete="email"
                  maxLength={160}
                  {...form.fieldProps("email")}
                />
              </fieldset>

              <fieldset>
                <legend>{copy.legends.delivery}</legend>
                <FormField
                  label={copy.fields.address}
                  autoComplete="street-address"
                  maxLength={300}
                  className="checkout-form__wide"
                  {...form.fieldProps("address")}
                />
                <FormField
                  label={copy.fields.cityArea}
                  autoComplete="address-level2"
                  maxLength={120}
                  {...form.fieldProps("cityArea")}
                />
                <FormField
                  label={copy.fields.notes}
                  multiline
                  optional
                  maxLength={1000}
                  className="checkout-form__wide"
                  {...form.fieldProps("notes")}
                />
              </fieldset>

              <div className="auth-form__submit">
                {quote && (
                  <section
                    className="checkout-quote"
                    aria-labelledby={`${form.baseId}-quote`}
                  >
                    <h3
                      id={`${form.baseId}-quote`}
                      className="checkout-quote__title"
                    >
                      {copy.quote.title}
                    </h3>
                    <ul className="checkout-quote__lines">
                      {quote.order.lines.map((line) => (
                        <li key={line.productId}>
                          <span>
                            <bdi>{orderLineName(line, locale)}</bdi> ×{" "}
                            {line.quantity}
                          </span>
                          <bdi>
                            {formatPrice(
                              line.lineTotal,
                              quote.order.currency,
                              locale,
                            )}
                          </bdi>
                        </li>
                      ))}
                    </ul>
                    <p className="checkout-quote__total">
                      <span>{copy.quote.total}</span>
                      <bdi>
                        {formatPrice(
                          quote.order.displayedTotal,
                          quote.order.currency,
                          locale,
                        )}
                      </bdi>
                    </p>
                  </section>
                )}
                <button
                  type="submit"
                  className="button-primary"
                  disabled={form.submitting}
                >
                  {form.submitting
                    ? copy.submitting
                    : quote
                      ? copy.quote.confirm
                      : copy.submit}{" "}
                  <Icon name="arrow" />
                </button>
                <p
                  id={`${form.baseId}-status`}
                  className={`auth-status${
                    form.status?.tone === "error" ? " is-error" : ""
                  }`}
                  role="status"
                >
                  {form.statusText}
                </p>
              </div>
              <p className="checkout-form__fineprint">
                {copy.fineprint(Boolean(whatsappDigits))}
              </p>
            </form>
          )}
        </section>

        {/* After submitting, the summary shows the stored order (server
            names and prices); the bag supplies only the pictures. Lines
            come back in bag order. */}
        <CheckoutSummary
          items={
            order
              ? order.lines.map((line, i) => ({
                  quantity: line.quantity,
                  product: {
                    ...(bag.items[i]?.product ?? bag.items[0].product),
                    id: line.productId,
                    name: orderLineName(line, locale),
                    price: line.unitPrice,
                    currency: order.currency,
                  },
                }))
              : bag.items
          }
          subtotal={order?.subtotal ?? bag.subtotal}
          currency={order?.currency ?? currency}
          gift={bag.gift}
          promoCode={bag.promoCode}
        />
      </Container>
    </div>
  )
}
