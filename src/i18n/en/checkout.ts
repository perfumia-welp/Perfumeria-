/*
 * Checkout screens, plus the order message the customer can also send to
 * the store (WhatsApp, or an email draft; see lib/orderRequest.ts). Orders
 * are stored by the server (/api/orders) before the confirmation shows. The
 * message follows the checkout language.
 */
export default {
  intro: {
    eyebrow: "Checkout",
    title: "Order request",
    lead: "Leave your details and we’ll personally confirm availability, delivery and the final total with you. No payment is taken online.",
  },
  backToBag: "Back to Bag",
  detailsLabel: "Your details",
  legends: {
    details: "Your Details",
    delivery: "Delivery",
  },
  fields: {
    fullName: "Full Name",
    phone: "Phone",
    email: "Email Address",
    address: "Delivery Address",
    cityArea: "City / Area",
    notes: "Order Notes",
  },
  submit: "Submit Order Request",
  submitting: "Sending Order Request",
  fineprint: (whatsapp: boolean) =>
    `No payment is taken online. When you submit, we save your request and send it to our team${
      whatsapp ? "; you can also send it to us on WhatsApp" : ""
    }. We’ll contact you to confirm it.`,
  /** Shown when the store’s prices differ from the bag’s (server quote). */
  quote: {
    title: "Updated prices",
    total: "New total",
    confirm: "Confirm Updated Total and Order",
  },
  /** Why an order was not accepted (server/orders.mjs error codes). */
  errors: {
    priceChanged:
      "Prices have changed since you added these items. Review the updated prices below, then confirm your order.",
    unavailable: (name: string) =>
      `This item is no longer available: ${name}. Remove it from your bag to continue.`,
    unavailableUnnamed:
      "An item in your bag is no longer available. Remove it from your bag to continue.",
    invalidItems:
      "An item in your bag no longer matches our catalogue. Return to your bag, review it and try again.",
    rateLimited:
      "Too many order attempts from this connection. Please wait a few minutes and try again, or contact us.",
    session: "We couldn’t start a secure session. Please try again.",
    sessionExpired:
      "Your session has expired. Refresh the page, then submit your order again.",
    locked:
      "This order can no longer be changed online. Please contact us and quote your reference.",
    failed:
      "Your order has not been confirmed. Check your connection and try again, or contact us.",
  },
  summary: {
    title: "Order Summary",
    quantity: "Quantity ",
    lineTotal: "Line total ",
    subtotal: "Subtotal",
    shipping: "Shipping",
    tax: "Tax",
    confirmedByStore: "Confirmed by the store",
    giftMessage: "Gift message",
    giftNoMessage: "Marked as a gift, no message",
    promoCode: "Promo code",
    promoNotApplied: "entered — not automatically applied",
    total: "Total",
    fineprint:
      "Shipping and tax are confirmed by the store before your order is finalised.",
    editBag: "Edit Bag",
  },
  confirmation: {
    reference: "Your reference",
    referenceHint: "Quote it in any message about this order.",
    heading: "Order request received",
    updatedHeading: "Order request updated",
    lead: {
      emailed:
        "Your request has been saved and sent to our team. We’ll be in touch to confirm availability, delivery and the final total.",
      updated:
        "Your changes have been saved and sent to our team as an update to this order. We’ll be in touch to confirm availability, delivery and the final total.",
      whatsapp:
        "Your request has been saved. Send it to us on WhatsApp as well so our team sees it straight away; we’ll reply to confirm availability, delivery and the final total.",
      mailto:
        "Your request has been saved, but it hasn’t reached our team by email yet. Email it to us, and we’ll reply to confirm availability, delivery and the final total.",
      sending: "Sending your request to our team…",
      failed:
        "Your request has been saved, but we couldn’t notify our team. Please contact us with your reference.",
    },
    emailLabel: "Email",
    email: {
      sending: "Sending your request to our team…",
      sent: "Your request has been emailed to our team.",
      mailto: (failed: boolean, address: string) =>
        `${
          failed
            ? "We couldn’t email your request automatically."
            : "Automatic email is not set up yet."
        } Use “Email Your Request” to open your email app addressed to ${address}, then press Send.`,
      failed: "We couldn’t email your request.",
    },
    whatsappLabel: "WhatsApp",
    whatsapp: {
      ready:
        "Opens with your order written out. Press Send in WhatsApp to deliver it to us.",
      unavailableBefore:
        "WhatsApp ordering is not available yet. You can also ",
      unavailableLink: "contact us",
      unavailableAfter: " with your reference.",
    },
    openWhatsApp: "Open WhatsApp",
    newTab: " (opens in a new tab)",
    emailRequest: "Email Your Request",
    editDetails: "Edit Details",
    keptNote:
      "Your bag is kept until you’re finished, in case you need to send the request again.",
    done: "Done — Clear Bag",
  },
  /** The plain-text order request (email draft / WhatsApp). */
  orderMessage: {
    /** Keeps a technical value (phone, email, code, price) readable; no-op in English. */
    ltr: (value: string) => value,
    /** Applied to every non-empty line; no-op in English. */
    line: (text: string) => text,
    subject: (reference: string, updated: boolean) =>
      `${updated ? "Updated order request" : "Order request"} ${reference}`,
    title: (reference: string, updated: boolean) =>
      `${updated ? "Updated order request" : "New order request"} ${reference}`,
    customer: "Customer",
    name: "Name",
    phone: "Phone",
    email: "Email",
    delivery: "Delivery",
    address: "Address",
    cityArea: "City / Area",
    order: "Order",
    item: (index: number, name: string, size: string | null) =>
      `${index}. ${name}${size ? ` (${size})` : ""}`,
    quantity: (quantity: number, unitPrice: string, lineTotal: string) =>
      `   ${quantity} × ${unitPrice} = ${lineTotal}`,
    subtotal: "Subtotal",
    shipping: "Shipping",
    tax: "Tax",
    confirmedByStore: "Confirmed by the store",
    displayedTotal: "Displayed total",
    giftMessage: (message: string) => `Gift message: "${message}"`,
    giftNoMessage: "Gift: yes (no message)",
    promo: (code: string) =>
      `Promo code: ${code} (entered — not automatically applied)`,
    notes: (notes: string) => `Notes: ${notes}`,
    closing: "Please confirm availability, delivery and the final total.",
  },
}
