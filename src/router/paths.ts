/*
 * Public routes, as English (default-language) paths. Links pass these to
 * AppLink, which adds the /ar prefix on Arabic pages; code that navigates
 * directly uses `localize` from useI18n(). Search is an overlay, not a route.
 */
export const paths = {
  home: "/",
  products: "/products",
  menPerfumes: "/men-perfumes",
  womenPerfumes: "/women-perfumes",
  about: "/about",
  contact: "/contact",
  faq: "/faq",
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

/**
 * Collection landing pages: the catalogue for one gender, at a stable URL of
 * its own. Only categories the live catalogue really has (company product
 * types 1344 men, 1382 women); there is no unisex collection page.
 */
export type CollectionGender = "men" | "women"
export const COLLECTIONS: CollectionGender[] = ["men", "women"]
export const collectionPath = (gender: CollectionGender) =>
  gender === "men" ? paths.menPerfumes : paths.womenPerfumes

/** Contact topics the form understands; each prefills a localized subject. */
export type ContactTopic = "wholesale"

/** The contact page opened for a topic, e.g. `/contact?topic=wholesale`. */
export const contactAbout = (topic: ContactTopic) =>
  `${paths.contact}?${new URLSearchParams({ topic })}`

/** Product listing filtered by a query-string value, e.g. `/products?gender=women`. */
export const productsWith = (param: string, value: string) =>
  `${paths.products}?${new URLSearchParams({ [param]: value })}`
