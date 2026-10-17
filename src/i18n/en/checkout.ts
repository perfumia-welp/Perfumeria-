/*
 * Checkout screens, plus the order message the customer sends to the store
 * (email draft now, WhatsApp once a number is configured; see
 * lib/orderRequest.ts). The message follows the checkout language.
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
  submitting: "Preparing Request",
  fineprint: (whatsapp: boolean) =>
    `No payment is taken online. After you submit, you can send the request to us ${
      whatsapp ? "on WhatsApp" : "by email"
    } and we’ll contact you to confirm it.`,
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
    heading: "Order request prepared",
    lead: {
      emailed:
        "Your request has been sent to our team. We’ll be in touch to confirm availability, delivery and the final total.",
      whatsapp:
        "Send it to us on WhatsApp to complete your request. We’ll reply to confirm availability, delivery and the final total.",
      mailto:
        "Your request has not been sent yet. Email it to us to complete it, and we’ll reply to confirm availability, delivery and the final total.",
      sending: "Sending your request to our team…",
      failed:
        "Your request could not be sent automatically. Please contact us with your reference to place this order.",
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
    subject: (reference: string) => `Order request ${reference}`,
    title: (reference: string) => `New order request ${reference}`,
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
