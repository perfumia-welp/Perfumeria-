import type { ComponentType } from "react"
import { createBrowserRouter, type RouteObject } from "react-router"
import SiteLayout, { type RouteHandle } from "@/components/layout/SiteLayout"
import { localeFromParam } from "@/i18n/locales"
import { loadMessages } from "@/i18n/messages"
import type { CollectionGender } from "@/router/paths"
import HomePage from "@/pages/HomePage"
import NotFoundPage from "@/pages/NotFoundPage"
import AccountOverviewPage from "@/pages/AccountOverviewPage"
import AccountOrdersPage from "@/pages/AccountOrdersPage"
import AccountWishlistPage from "@/pages/AccountWishlistPage"
import AccountAddressesPage from "@/pages/AccountAddressesPage"
import AccountDetailsPage from "@/pages/AccountDetailsPage"

/*
 * The homepage and 404 are bundled with the app; every other page is its own
 * chunk, fetched on first visit. The router keeps the current page on screen
 * until the next one has loaded, so navigation has no blank state.
 */
type PageModule = Promise<{ default: ComponentType }>
const loaders: Array<() => Promise<unknown>> = []
const page = (load: () => PageModule): RouteObject["lazy"] => {
  loaders.push(load)
  return async () => ({ Component: (await load()).default })
}

/**
 * Once the first page is up and the browser is idle, fetch the other page
 * chunks so later navigation is as immediate as before code splitting.
 */
export function prefetchPages() {
  const run = () => loaders.forEach((load) => void load().catch(() => {}))
  if ("requestIdleCallback" in window)
    window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 2000)
}

/** Account sits behind RequireAuth; both load together. */
loaders.push(() => import("@/pages/AccountPage"))
const accountLayout: RouteObject["lazy"] = async () => {
  const [{ default: RequireAuth }, { default: AccountPage }] =
    await Promise.all([
      import("@/auth/RequireAuth"),
      import("@/pages/AccountPage"),
    ])
  return {
    Component: () => (
      <RequireAuth>
        <AccountPage />
      </RequireAuth>
    ),
  }
}

/** Vite's base path ("/" locally, a sub-path when deployed by Figma Make). */
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/"

const handle = (key: RouteHandle["page"]): RouteHandle => ({ page: key })
/** Pages for one visitor (bag, account, sign-in): never offered to search engines. */
const privateHandle = (key: RouteHandle["page"]): RouteHandle => ({
  page: key,
  noindex: true,
})

/** A collection landing page: the Products page fixed to one gender (same chunk). */
const collectionPage =
  (gender: CollectionGender): RouteObject["lazy"] =>
  async () => {
    const { default: ProductsPage } = await import("@/pages/ProductsPage")
    return { Component: () => <ProductsPage collection={gender} /> }
  }

/*
 * Paths are relative to the optional language segment below, so each page
 * is defined once and serves both /products and /ar/products. Paths and
 * product slugs are the same in both languages.
 */
const pageRoutes: RouteObject[] = [
  { index: true, element: <HomePage />, handle: handle("home") },
  {
    path: "products",
    lazy: page(() => import("@/pages/ProductsPage")),
    handle: handle("products"),
  },
  {
    path: "products/:slug",
    lazy: page(() => import("@/pages/ProductPage")),
    handle: { product: true } satisfies RouteHandle,
  },
  {
    path: "men-perfumes",
    lazy: collectionPage("men"),
    handle: { page: "menPerfumes", collection: "men" } satisfies RouteHandle,
  },
  {
    path: "women-perfumes",
    lazy: collectionPage("women"),
    handle: { page: "womenPerfumes", collection: "women" } satisfies RouteHandle,
  },
  {
    path: "wishlist",
    lazy: page(() => import("@/pages/WishlistPage")),
    handle: privateHandle("wishlist"),
  },
  {
    path: "about",
    lazy: page(() => import("@/pages/AboutPage")),
    handle: { page: "about", arabicDraft: true } satisfies RouteHandle,
  },
  {
    path: "contact",
    lazy: page(() => import("@/pages/ContactPage")),
    handle: handle("contact"),
  },
  {
    path: "faq",
    lazy: page(() => import("@/pages/FaqPage")),
    handle: { page: "faq", englishOnly: true } satisfies RouteHandle,
  },
  {
    path: "returns",
    lazy: page(() => import("@/pages/ReturnsPage")),
    handle: handle("returns"),
  },
  {
    path: "account",
    lazy: accountLayout,
    handle: privateHandle("account"),
    children: [
      { index: true, element: <AccountOverviewPage /> },
      { path: "orders", element: <AccountOrdersPage /> },
      { path: "wishlist", element: <AccountWishlistPage /> },
      { path: "addresses", element: <AccountAddressesPage /> },
      { path: "details", element: <AccountDetailsPage /> },
    ],
  },
  {
    path: "sign-in",
    lazy: page(() => import("@/pages/SignInPage")),
    handle: privateHandle("signIn"),
  },
  {
    path: "sign-up",
    lazy: page(() => import("@/pages/SignUpPage")),
    handle: privateHandle("signUp"),
  },
  {
    path: "forgot-password",
    lazy: page(() => import("@/pages/ForgotPasswordPage")),
    handle: privateHandle("forgotPassword"),
  },
  {
    path: "reset-password",
    lazy: page(() => import("@/pages/ResetPasswordPage")),
    handle: privateHandle("resetPassword"),
  },
  {
    path: "cart",
    lazy: page(() => import("@/pages/CartPage")),
    handle: privateHandle("cart"),
  },
  {
    path: "checkout",
    lazy: page(() => import("@/pages/CheckoutPage")),
    handle: privateHandle("checkout"),
  },
  {
    path: "*",
    element: <NotFoundPage />,
    handle: handle("notFound"),
  },
]

export const router = createBrowserRouter(
  [
    {
      element: <SiteLayout />,
      // A directly opened page waits for its chunk (and, under /ar, the
      // Arabic messages) before the first render; nothing is shown meanwhile
      // (the ivory page background), as before.
      HydrateFallback: () => null,
      // Loads the language's messages before its pages render. English is
      // bundled; Arabic is fetched once. If that fails the page still works
      // in English rather than showing an error.
      loader: async ({ params }) => {
        await loadMessages(localeFromParam(params.lang)).catch(() => null)
        return null
      },
      shouldRevalidate: ({ currentParams, nextParams }) =>
        currentParams.lang !== nextParams.lang,
      children: [
        /*
         * One route tree for both languages: "/products" and
         * "/ar/products" match the same routes, so switching language keeps
         * the page mounted (form input, scroll, open panels) instead of
         * rebuilding it. Any other value of :lang is a 404 (SiteLayout).
         */
        { path: ":lang?", children: pageRoutes },
      ],
    },
  ],
  { basename },
)
