import { useEffect, useRef } from "react"
import { company } from "@/config/company"
import { useI18n } from "@/i18n/i18nContext"
import { getMessages } from "@/i18n/messages"
import { orderMailtoUrl, orderWhatsAppUrl } from "@/lib/orderRequest"
import { paths } from "@/router/paths"
import type { ServiceResult } from "@/types/commerce"
import type { OrderRequest } from "@/types/order"
import AppLink from "../ui/AppLink"
import Icon from "../ui/Icon"

export type EmailState = "sending" | ServiceResult["status"]

interface CheckoutConfirmationProps {
  order: OrderRequest
  emailState: EmailState
  onEdit: () => void
  onDone: () => void
}

/*
 * Shown after a valid request. Nothing here claims the request reached the
 * store unless the server email succeeded: WhatsApp and the email-app
 * fallback both need the customer to press Send themselves. The bag is kept
 * until they choose "Done — Clear Bag". The WhatsApp message and email draft
 * follow the checkout language (lib/orderRequest).
 */
export default function CheckoutConfirmation({
  order,
  emailState,
  onEdit,
  onDone,
}: CheckoutConfirmationProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const copy = useI18n().t.checkout.confirmation
  // Written in the language the order was placed in, even after a switch.
  const messageText = getMessages(order.locale).checkout.orderMessage
  const whatsappUrl = orderWhatsAppUrl(order, messageText)
  const mailtoUrl = orderMailtoUrl(order, messageText)
  const emailed = emailState === "success"
  /** The customer sends the email from their own app when the server did not. */
  const offerMailto =
    mailtoUrl && (emailState === "unavailable" || emailState === "error")

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  let lead: string
  if (emailed) lead = copy.lead.emailed
  else if (whatsappUrl) lead = copy.lead.whatsapp
  else if (offerMailto) lead = copy.lead.mailto
  else if (emailState === "sending") lead = copy.lead.sending
  else lead = copy.lead.failed

  let emailText: string
  if (emailState === "sending") emailText = copy.email.sending
  else if (emailed) emailText = copy.email.sent
  else if (offerMailto)
    emailText = copy.email.mailto(emailState === "error", company.orderEmail)
  else emailText = copy.email.failed

  return (
    <div className="checkout-confirmation">
      <div className="checkout-confirmation__reference">
        <p className="eyebrow">{copy.reference}</p>
        <p className="checkout-confirmation__code">{order.reference}</p>
        <p className="checkout-confirmation__hint">{copy.referenceHint}</p>
      </div>

      <h2 ref={headingRef} tabIndex={-1}>
        {copy.heading}
      </h2>
      <p className="checkout-confirmation__lead">{lead}</p>

      <dl className="checkout-confirmation__status">
        <div>
          <dt>{copy.emailLabel}</dt>
          <dd
            role="status"
            className={emailState === "error" ? "is-error" : undefined}
          >
            {emailText}
          </dd>
        </div>
        <div>
          <dt>{copy.whatsappLabel}</dt>
          <dd>
            {whatsappUrl ? (
              copy.whatsapp.ready
            ) : (
              <>
                {copy.whatsapp.unavailableBefore}
                <AppLink href={paths.contact}>
                  {copy.whatsapp.unavailableLink}
                </AppLink>
                {copy.whatsapp.unavailableAfter}
              </>
            )}
          </dd>
        </div>
      </dl>

      <div className="checkout-confirmation__actions">
        {whatsappUrl && (
          <a
            className="button-primary"
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {copy.openWhatsApp} <Icon name="arrow" />
            <span className="visually-hidden">{copy.newTab}</span>
          </a>
        )}
        {offerMailto &&
          (whatsappUrl ? (
            <a className="checkout-link" href={mailtoUrl}>
              {copy.emailRequest}
            </a>
          ) : (
            <a className="button-primary" href={mailtoUrl}>
              {copy.emailRequest} <Icon name="arrow" />
            </a>
          ))}
        <button type="button" className="checkout-link" onClick={onEdit}>
          {copy.editDetails}
        </button>
      </div>

      <div className="checkout-confirmation__done">
        <p>{copy.keptNote}</p>
        <button type="button" className="checkout-link" onClick={onDone}>
          {copy.done}
        </button>
      </div>
    </div>
  )
}
