/* Product cards, the wishlist heart and the product detail page. */
export default {
  addToBag: "Add to Bag",
  /** The hover button on homepage cards. */
  addToBagShort: "Add to bag",
  addToBagLabel: (name: string) => `Add to bag, ${name}`,
  /**
   * Replaces "Add to Bag" on cards of products with company options (box /
   * no box): it opens the product page, where the option is picked.
   */
  chooseOptions: "Choose Options",
  chooseOptionsShort: "Choose options",
  chooseOptionsLabel: (name: string) => `Choose options, ${name}`,
  /** Briefly replaces "Add to Bag" on the Scent Poster card. */
  added: "Added",
  inStock: "In Stock",
  outOfStock: "Out of Stock",
  /** A live product page while its company detail loads. */
  loading: "Loading the fragrance…",
  /** Company options on live products (with box / without box). */
  options: {
    loading: "Loading options…",
    error: "The options could not be loaded.",
    retry: "Try again",
    required: "Choose an option to add this to your bag.",
  },
  wishlist: {
    save: "Save to wishlist",
    remove: "Remove from wishlist",
    saveVisible: "Save to Wishlist",
    removeVisible: "Remove from Wishlist",
    label: (action: string, name: string) => `${action}, ${name}`,
  },
  gallery: {
    label: "Product images",
    bottle: "Bottle",
    photograph: "Photograph",
    show: (index: number, total: number, view: string) =>
      `Show image ${index} of ${total}: ${view}`,
  },
  breadcrumb: "Breadcrumb",
  breadcrumbRoot: "Fragrances",
  size: "Size",
  quantity: "Quantity",
  soldOut: "Currently out of stock. Save it to your wishlist to return later.",
  service:
    "No payment is taken online. Our team personally confirms availability, delivery and the final total with you.",
  sections: {
    fragrance: "The Fragrance",
    composition: "Composition",
    character: "Character",
    details: "Details",
  },
  composition: {
    top: "Top notes",
    heart: "Heart notes",
    base: "Base notes",
  },
  dossier: {
    notes: "Notes",
    closeNotes: "Close notes",
    viewFragrance: "View fragrance",
    /** Card C sheet row when the product has no notes yet. */
    price: "Price",
  },
  details: {
    family: "Fragrance family",
    for: "For",
    size: "Size",
    keyNotes: "Key notes",
    availability: "Availability",
    inStock: "In stock",
    outOfStock: "Out of stock",
  },
  related: {
    eyebrow: "Continue exploring",
    title: "You may also like",
  },
}
