/* Shared words and accessibility text used by several components. */
export default {
  optional: "Optional",
  close: "Close",
  sending: "Sending…",
  genericError: "Something went wrong. Please try again.",
  /** Joins items in running text, e.g. "Bergamot, Pink Pepper". */
  listSeparator: ", ",
  /** Unit after a size value: "50ml" is shown as "50 ml". */
  millilitres: "ml",
  /** Size on product cards and search results, as written in the catalogue ("50ml"). */
  compactSize: (size: string) => size,
  fragranceCount: (count: number) =>
    `${count} ${count === 1 ? "Fragrance" : "Fragrances"}`,
  price: {
    original: "Original price",
    sale: ", sale price",
    /** Before a price-changing option is chosen: "From EGP 900". */
    from: "From",
  },
  quantity: {
    group: (name: string) => `Quantity, ${name}`,
    /** Visually hidden prefix before the number. */
    current: "Quantity ",
    decrease: "Decrease quantity",
    increase: "Increase quantity",
  },
}
