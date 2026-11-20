import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { useAuth, userNames } from "@/auth/authContext"
import { useBag } from "@/cart/bagContext"
import CheckoutSummary from "@/components/checkout/CheckoutSummary"
import OrderDetailsFields from "@/components/checkout/OrderDetailsFields"
import QuoteNotice from "@/components/checkout/QuoteNotice"
import AppLink from "@/components/ui/AppLink"
import Container from "@/components/ui/Container"
import Icon from "@/components/ui/Icon"
import PageIntro from "@/components/ui/PageIntro"
import PendingRedirect from "@/components/ui/PendingRedirect"
import { whatsappDigits } from "@/config/company"
import { useOrderRules } from "@/hooks/useOrderRules"
import { useValidatedForm } from "@/hooks/useValidatedForm"
import { useI18n } from "@/i18n/i18nContext"
import { formatPrice } from "@/lib/formatPrice"
import {
  EMPTY_ORDER_DETAILS,
  validateOrderDetails,
  type OrderDetailsField,
} from "@/lib/orderDetails"
import { orderErrorMessage } from "@/lib/orderErrors"
import { buildOrderRequest } from "@/lib/orderRequest"
import { writeOrderSession } from "@/lib/orderSession"
import { minimumOrderShortfall } from "@/lib/minimumOrder"
import type { CartLocationState } from "@/pages/CartPage"
import { orderPath, paths } from "@/router/paths"
import { getProfile, listAddresses } from "@/services/account"
import { submitOrder } from "@/services/orders"
import type { OrderRequest } from "@/types/order"
import "./CartPage.css"
import "./AuthPage.css"
import "./CheckoutPage.css"

/** The server's corrected prices, for the bag they were quoted for. */
interface Quote {
  order: OrderRequest
  signature: string
}

/**
 * The reference of a request being placed from this tab's bag (one bag
 * owner): a retry after a lost answer stays the same order. Forgotten as soon
 * as the order is stored, so the next checkout is a new order.
 */
const referenceStorageKey = (owner: string) =>
  `perfumira:checkout-reference:${owner}`

/*
 * Checkout: a new order request from the shopping bag, not a payment. The
 * server (/api/orders) checks it against the company catalogue and stores
 * it. Once stored, the bag is emptied and the order page
 * (/order/:reference) takes over: confirmation, WhatsApp, and "Edit
 * Details", which edits the stored order itself, never the bag. Signing in
 * is optional: it prefills the form from the account (profile, email and
 * default address) and shows the order in the account's history.
 */
export default function CheckoutPage() {
  const bag = useBag()
  const { user, bagOwnerId, startGuestSession } = useAuth()
  const navigate = useNavigate()
  const { t, locale, localize } = useI18n()
  const copy = t.checkout
  const form = useValidatedForm<OrderDetailsField>(
    EMPTY_ORDER_DETAILS,
    validateOrderDetails,
    (t) => t.checkout.invalid,
  )
  const [finishing, setFinishing] = useState(false)
  const reference = useRef<string | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  // The merchant's minimum order from Welp (via GET /api/order-rules).
  const { state: rules } = useOrderRules()
  // A different bag owner (sign-in, sign-out, a new guest) starts over.
  useEffect(() => {
    setQuote(null)
    reference.current = null
  }, [bagOwnerId])

  // Edits used to live here, tied to the bag (before 2026-11-20).
  useEffect(() => {
    try {
      sessionStorage.removeItem("perfumira:checkout-edit")
    } catch {
      /* Optional storage. */
    }
  }, [])

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

  // `finishing`: the order is stored and the bag emptied; the order page is
  // opening, so the empty-bag redirect to /cart must not run.
  if (finishing) return <div className="page-pending" />

  // The saved bag (or its products) may still be loading after a refresh.
  if (bag.items.length === 0 && !bag.isReady) {
    return (
      <Container as="section" className="empty-cart page-pending">
        <p className="empty-cart__lead" role="status">
          {t.cart.loading}
        </p>
      </Container>
    )
  }

  if (bag.items.length === 0) {
    return <PendingRedirect to={localize(paths.cart)} replace />
  }

  // Opened directly (or the bag changed elsewhere) below the minimum order:
  // back to the bag, which shows the same message as its Checkout button.
  // While some lines are still loading the subtotal is partial, so wait
  // rather than redirect. Checked on what the customer pays, after the Buy 3,
  // Get the 4th Free promotion, against the merchant's minimum from Welp.
  // Until that minimum is known the form waits; if it cannot be read, the
  // bag says checkout is unavailable.
  const belowMinimum =
    rules.status === "error" ||
    (rules.status === "ready" &&
      minimumOrderShortfall(bag.total, rules.rules.minimumOrderSubtotal) > 0)
  if (rules.status === "loading") return <div className="page-pending" />
  if (belowMinimum) {
    if (!bag.isReady) return <div className="page-pending" />
    return (
      <PendingRedirect
        to={localize(paths.cart)}
        replace
        state={{ minimumOrder: true } satisfies CartLocationState}
      />
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
      // Stored: the order page shows it from the server's record (cached for
      // this tab), and the bag is emptied so it cannot be ordered twice.
      writeOrderSession({
        owner,
        order: result.order,
        emailState: result.emailState ?? "error",
      })
      try {
        sessionStorage.removeItem(referenceKey)
      } catch {
        /* Optional storage. */
      }
      reference.current = null
      setFinishing(true)
      bag.clearBag()
      navigate(localize(orderPath(result.order.reference)), { replace: true })
      return
    }
    if (result.error === "price_changed" && result.order) {
      setQuote({ order: result.order, signature })
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
    // The server's verified subtotal is under the minimum (e.g. a price fell).
    if (
      result.error === "minimum_order_not_met" &&
      typeof result.minimum === "number" &&
      typeof result.subtotal === "number"
    ) {
      const { minimum, subtotal } = result
      const quoted = result.currency ?? currency
      form.setStatus({
        tone: "error",
        message: (t) =>
          t.cart.minimumOrder(
            formatPrice(minimum, quoted, locale),
            formatPrice(minimumOrderShortfall(subtotal, minimum), quoted, locale),
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

  return (
    <div className="checkout-page">
      <PageIntro intro={copy.intro}>
        <AppLink className="cart-back" href={paths.cart}>
          <Icon name="arrow" /> {copy.backToBag}
        </AppLink>
      </PageIntro>

      <Container className="checkout-layout">
        <section className="checkout-main" aria-label={copy.detailsLabel}>
          <form
            ref={form.formRef}
            className="checkout-form"
            noValidate
            onSubmit={submit}
            aria-describedby={`${form.baseId}-status`}
          >
            <p className="checkout-form__required-note">{copy.requiredNote}</p>
            <OrderDetailsFields form={form} />

            <div className="auth-form__submit">
              {quote && <QuoteNotice order={quote.order} />}
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
        </section>

        <CheckoutSummary
          items={bag.items}
          subtotal={bag.subtotal}
          discount={bag.promotion.discount}
          total={bag.total}
          freeByLine={bag.promotion.freeByLine}
          currency={currency}
          gift={bag.gift}
          promoCode={bag.promoCode}
        />
      </Container>
    </div>
  )
}
