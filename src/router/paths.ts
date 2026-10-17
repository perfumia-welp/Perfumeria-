/*
 * Public routes, as English (default-language) paths. Links pass these to
 * AppLink, which adds the /ar prefix on Arabic pages; code that navigates
 * directly uses `localize` from useI18n(). Search is an overlay, not a route.
 */
export const paths = {
  home: "/",
  products: "/products",
  about: "/about",
  contact: "/contact",
  account: "/account",
  accountOrders: "/account/orders",
  accountWishlist: "/account/wishlist",
  accountAddresses: "/account/addresses",
  accountDetails: "/account/details",
  cart: "/cart",
  checkout: "/checkout",
  signIn: "/sign-in",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  wishlist: "/wishlist",
} as const

/** A product page, e.g. `/products/velvet-iris` (the slug is the same in every language). */
export const productPath = (slug: string) =>
  `${paths.products}/${encodeURIComponent(slug)}`

/** Product listing filtered by a query-string value, e.g. `/products?gender=women`. */
export const productsWith = (param: string, value: string) =>
  `${paths.products}?${new URLSearchParams({ [param]: value })}`
