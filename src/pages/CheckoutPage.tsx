import { useEffect, useRef, useState } from "react"
import { Navigate, useNavigate } from "react-router"
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
import { whatsappDigits } from "@/config/company"
import { useValidatedForm, type ValidationKey } from "@/hooks/useValidatedForm"
import { useI18n } from "@/i18n/i18nContext"
import { buildOrderRequest, type CheckoutDetails } from "@/lib/orderRequest"
import { isValidEmail, isValidPhone } from "@/lib/validation"
import { paths } from "@/router/paths"
import { getProfile, listAddresses } from "@/services/account"
import { saveOrderToHistory, sendOrderRequestEmail } from "@/services/orders"
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

/*
 * Checkout MVP: an order request, not a payment. The request is emailed to
 * the store (when configured) and handed to the customer as a prefilled
 * WhatsApp message; the store then confirms the order personally. Signing
 * in is optional: it prefills the form from the account (profile, email and
 * default address) and keeps a copy of the request in the order history.
 *
 * One reference per checkout visit: "Edit Details" and submitting again
 * reuses it, so the WhatsApp message, the email and the history record all
 * describe the same request (the database updates that record in place).
 */
export default function CheckoutPage() {
  const bag = useBag()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t, locale, localize } = useI18n()
  const copy = t.checkout
  const form = useValidatedForm<Field>(EMPTY, validate)
  const [order, setOrder] = useState<OrderRequest | null>(null)
  const [emailState, setEmailState] = useState<EmailState>("sending")
  const [finishing, setFinishing] = useState(false)
  const reference = useRef<string | null>(null)
  // History saves run one after another, so an edited resubmit always lands
  // after the first save even if that one is still in flight.
  const historySaves = useRef(Promise.resolve())

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
      <Container as="section" className="empty-cart">
        <p className="empty-cart__lead" role="status">
          {t.cart.loading}
        </p>
      </Container>
    )
  }

  if (bag.items.length === 0) {
    return finishing ? null : <Navigate to={localize(paths.cart)} replace />
  }

  const currency = bag.items[0].product.currency

  const submit = form.onSubmit(async (values) => {
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
    setOrder(request)
    // Signed-in customers also get it in Account → Orders; guests are not saved.
    if (user)
      historySaves.current = historySaves.current.then(() =>
        saveOrderToHistory(request),
      )
    setEmailState("sending")
    const result = await sendOrderRequestEmail(request)
    setEmailState(result.status)
  })

  // `finishing` stops the empty-bag redirect to /cart from overriding this
  // navigation (the router applies its update as a transition, after ours).
  const done = () => {
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
                <button
                  type="submit"
                  className="button-primary"
                  disabled={form.submitting}
                >
                  {form.submitting ? copy.submitting : copy.submit}{" "}
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

        <CheckoutSummary
          items={bag.items}
          subtotal={bag.subtotal}
          currency={currency}
          gift={bag.gift}
          promoCode={bag.promoCode}
        />
      </Container>
    </div>
  )
}
