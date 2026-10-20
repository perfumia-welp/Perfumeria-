/* The shopping bag page, its order summary and the "added" notice. */
export default {
  intro: {
    eyebrow: "Shopping bag",
    title: "Your selections",
  },
  itemCount: (count: number) => `${count} ${count === 1 ? "Item" : "Items"}`,
  added: (name: string) => `${name} added to your bag`,
  /** A visitor's line when the bag cannot be saved (no guest identity). */
  addedForVisit: (name: string) =>
    `${name} added. Your bag is kept for this visit only; sign in to save it.`,
  /** A change to a signed-in customer's saved bag failed. */
  saveError: "Your bag could not be updated. Please try again.",
  loading: "Loading your bag…",
  /** A saved line whose product, option or stock is gone. */
  unavailable: {
    name: "A fragrance in your bag",
    note: "No longer available. It will not be included in your order.",
  },
  empty: {
    eyebrow: "Your bag is empty",
    /** One entry per line of the heading. */
    title: ["A signature scent", "is still waiting for you."],
    lead: "Discover fragrances selected for character, mood and memory.",
    action: "Explore Fragrances",
  },
  continueShopping: "Continue Shopping",
  itemsLabel: "Items in your bag",
  removed: (name: string) => `${name} removed.`,
  undo: "Undo",
  line: {
    quantity: "Quantity",
    remove: "Remove",
    removeLabel: (name: string) => `Remove ${name}`,
    /** "$276 for 2" */
    lineTotal: (total: string, quantity: number) => `${total} for ${quantity}`,
  },
  gift: {
    toggle: "This order is a gift",
    label: "Gift message (optional)",
    placeholder: "Add a complimentary gift message (optional)",
  },
  summary: {
    title: "Order Summary",
    subtotal: "Subtotal",
    shipping: "Shipping",
    estimatedTax: "Estimated Tax",
    calculatedAtCheckout: "Calculated at checkout",
    promoToggle: "Have a promo code?",
    promoLabel: "Promo code",
    promoPlaceholder: "Promo code",
    apply: "Apply",
    promoEmpty: "Please enter a promo code.",
    promoUnavailable:
      "Promo codes can’t be applied yet. Your total has not changed.",
    total: "Total",
    fineprint: "Shipping and tax are calculated at checkout.",
    proceed: "Proceed to Checkout",
  },
  mobileBar: {
    total: "Total",
    checkout: "Checkout",
  },
}
