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
    details: "Contact Details",
    delivery: "Delivery Address",
  },
  /** Required labels carry a quiet "*"; optional ones say "Optional". */
  requiredNote: "Fields marked * are required.",
  fields: {
    fullName: "Full Name",
    phone: "Phone Number",
    email: "Email Address",
    address: "Street Address",
    cityArea: "City / Area",
    notes: "Order Notes",
  },
  /** Examples of the expected format, never a repeat of the label. */
  placeholders: {
    fullName: "e.g. Nour Hassan",
    phone: "e.g. 01X XXXX XXXX",
    email: "name@example.com",
    address: "Building no., street, floor, apartment",
    cityArea: "e.g. Nasr City, Cairo",
    notes: "e.g. a nearby landmark or the best time to deliver",
  },
  /** Shown under the submit button when fields need correcting. */
  invalid: "Some details need attention. See the message under each field.",
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
      "Shipping is confirmed by the store before your order is finalised.",
    editBag: "Edit Bag",
  },
  /** Editing a stored order (Edit Details on the confirmation). */
  edit: {
    noChanges:
      "No changes yet. Update your details here or your bag, and the options to save will appear.",
    backToOrder: "Back to Your Order",
    /** The order's own lines (the shopping bag is not touched). */
    itemsLegend: "Your Items",
    remove: "Remove",
    removeLabel: (name: string): string => `Remove ${name} from this order`,
    lastItem: "An order needs at least one item.",
    /** Add a Product, inside Edit Order (the shopping bag is not used). */
    addProduct: "Add a Product",
    closeAdd: "Close",
    searchLabel: "Search the collection",
    searchPlaceholder: "Search by name or brand",
    searchHint: "Type at least 2 letters to search.",
    noResults: "No products match your search.",
    addToOrder: "Add to Order",
    backToResults: "Back to Results",
    added: (name: string): string => `Added to this order: ${name}.`,
    /** Gift message and promo code of the order being edited. */
    extrasLegend: "Gift & Promo Code",
    promoHint: "Recorded for our team to review; not applied automatically.",
    /** Below the merchant's minimum after an edit (amounts formatted). */
    belowMinimum: (minimum: string, remaining: string): string =>
      `The minimum order is ${minimum}. Add ${remaining} more to save these changes.`,
    /** Above the disabled save actions while a field has an error; field names follow. */
    blocked: (count: number): string =>
      count === 1
        ? "To save your changes, first correct this field:"
        : "To save your changes, first correct these fields:",
    saveAndSend: "Save & Send Updated Order",
    save: "Save Changes",
    saveHint:
      "“Save Changes” keeps your edits without notifying our team yet; you can send them afterwards.",
  },
  confirmation: {
    reference: "Your reference",
    referenceHint: "Quote it in any message about this order.",
    heading: "Order request received",
    updatedHeading: "Order request updated",
    savedHeading: "Changes saved",
    sendUpdated: "Send Updated Order",
    lead: {
      emailed:
        "Thank you, your order is already with our team. We’ll contact you soon to confirm availability, delivery and the final total. You don’t need to do anything else.",
      updated:
        "Thank you, your updated order is already with our team. We’ll contact you soon to confirm availability, delivery and the final total. You don’t need to do anything else.",
      saved:
        "Your changes are saved to this order but haven’t been sent to our team yet. Send them when you’re ready, so we can update your order.",
      unchanged:
        "Your order is up to date: our team already has this version, so nothing new was sent.",
      whatsapp:
        "Your order is saved, but our team hasn’t been notified yet. Please send it to us on WhatsApp so we see it straight away. We’ll reply to confirm availability, delivery and the final total.",
      mailto:
        "Your request has been saved, but it hasn’t reached our team by email yet. Email it to us, and we’ll reply to confirm availability, delivery and the final total.",
      sending: "Sending your request to our team…",
      failed:
        "Your request has been saved, but we couldn’t notify our team. Please contact us with your reference.",
    },
    emailLabel: "Email",
    email: {
      sending: "Sending your request to our team…",
      sent: "Sent. Our team has your order.",
      notSent: "Not sent to our team yet.",
      unchanged: "Our team already has this version.",
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
      /** The team already has the order (emailed, or this version is unchanged). */
      optional:
        "Optional: For a faster reply, open WhatsApp and press Send. Your order is already saved.",
      /** The team has not been notified: WhatsApp is how the order reaches us. */
      ready:
        "“Open WhatsApp” starts a chat with us with your order already written in. Press Send so it reaches our team.",
      unavailableBefore:
        "WhatsApp ordering is not available yet. You can also ",
      unavailableLink: "contact us",
      unavailableAfter: " with your reference.",
    },
    openWhatsApp: "Open WhatsApp",
    newTab: " (opens in a new tab)",
    emailRequest: "Email Your Request",
    editDetails: "Edit Details",
    continueShopping: "Continue Shopping",
  },
  /** The order page (/order/:reference) when it cannot show the order. */
  orderPage: {
    loading: "Loading your order…",
    missingTitle: "We couldn’t open this order",
    missing:
      "It isn’t available in this browser. If you placed it while signed in, sign in first. You can also contact us with your reference.",
    failed: "We couldn’t load your order right now. Please try again in a moment.",
    retry: "Try Again",
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
    /** A line's units made free by Buy 3, Get the 4th Free. */
    freeUnits: (free: number, discount: string) =>
      `   Buy 3, Get the 4th Free: ${free} free (−${discount})`,
    subtotal: "Subtotal",
    promotion: "Buy 3, Get the 4th Free",
    payableSubtotal: "Final subtotal",
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
