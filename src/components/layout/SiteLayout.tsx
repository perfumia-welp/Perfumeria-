import { useEffect, useMemo, useRef, type MouseEvent } from "react"
import {
  Outlet,
  ScrollRestoration,
  useLocation,
  useMatches,
} from "react-router"
import { brand, getSiteNavigation } from "@/data/site"
import { useI18n } from "@/i18n/i18nContext"
import { LOCALE_SEGMENT, localizePath, stripLocale } from "@/i18n/locales"
import type { Messages } from "@/i18n/messages"
import { setDocumentMeta } from "@/lib/documentMeta"
import NotFoundPage from "@/pages/NotFoundPage"
import { useCatalogState } from "@/hooks/useCatalogState"
import { findProductForPage } from "@/services/catalog"
import ContactLauncher from "./ContactLauncher"
import Footer from "./Footer"
import Header from "./Header"
import InstantScrollOnNavigate from "./InstantScrollOnNavigate"

type PageKey = keyof Messages["meta"]["pages"]

/** Optional per-route metadata, set as `handle` in the route config. */
export interface RouteHandle {
  /** Title and description from the `meta.pages` messages of this key. */
  page?: PageKey
  /** Product pages: title and description come from the product itself. */
  product?: boolean
}

/** Vite's deploy base without the trailing slash ("" locally). */
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

/** Shared frame for every page: skip link, header, main landmark, footer. */
export default function SiteLayout() {
  const mainRef = useRef<HTMLElement>(null)
  const { pathname, hash } = useLocation()
  const matches = useMatches()
  const { t, locale } = useI18n()
  // Product titles follow the live catalogue as it loads.
  useCatalogState()
  const previousPage = useRef(stripLocale(pathname))

  const leaf = matches[matches.length - 1]
  const params = leaf?.params ?? {}
  // Only "ar" may precede a page; /fr/products or /en/about are not pages.
  const unknownLanguage =
    params.lang !== undefined && params.lang !== LOCALE_SEGMENT
  const routeHandle = unknownLanguage
    ? { page: "notFound" as const }
    : leaf?.handle as RouteHandle | undefined

  let routeTitle: string | undefined
  let description = t.meta.siteDescription
  let hasCanonical = true
  if (routeHandle?.product) {
    const product = findProductForPage(params.slug ?? "", locale)
    routeTitle = product?.name ?? t.meta.pages.notFound.title
    description =
      product?.story?.description ?? t.meta.pages.notFound.description
    hasCanonical = Boolean(product)
  } else if (routeHandle?.page) {
    routeTitle = t.meta.pages[routeHandle.page].title
    description = t.meta.pages[routeHandle.page].description
    hasCanonical = routeHandle.page !== "notFound"
  }
  const siteTitle = t.meta.siteTitle

  useEffect(() => {
    setDocumentMeta({
      title: routeTitle ? `${routeTitle} · ${siteTitle}` : siteTitle,
      description,
      locale,
      canonicalPath: hasCanonical ? `${basePath}${pathname}` : null,
      alternates: hasCanonical
        ? {
            en: `${basePath}${localizePath(pathname, "en")}`,
            ar: `${basePath}${localizePath(pathname, "ar")}`,
          }
        : null,
    })
  }, [routeTitle, siteTitle, description, hasCanonical, pathname, locale])

  // On a page change (not a filter/query or language change), move focus to
  // the new page's content so keyboard and screen-reader users start at the
  // top of it. Switching language leaves focus on the switcher.
  useEffect(() => {
    const page = stripLocale(pathname)
    if (previousPage.current === page) return
    previousPage.current = page
    if (!hash) mainRef.current?.focus({ preventScroll: true })
  }, [pathname, hash])

  const skipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    mainRef.current?.focus()
  }

  const site = useMemo(() => getSiteNavigation(t), [t])
  // WhatsApp is the launcher's own "Chat with us" action, so it is not
  // repeated among the accounts to follow.
  const launcherSocialLinks = useMemo(
    () => site.socialLinks.filter((link) => link.platform !== "whatsapp"),
    [site],
  )

  return (
    <>
      <a className="skip-link" href="#main" onClick={skipToContent}>
        {t.navigation.skipToContent}
      </a>
      <Header
        brandName={brand.name}
        homeHref={brand.homeHref}
        accountHref={brand.accountHref}
        cartHref={brand.cartHref}
        navigation={site.mainNavigation}
      />
      <main id="main" ref={mainRef} tabIndex={-1}>
        {unknownLanguage ? <NotFoundPage /> : <Outlet />}
      </main>
      <Footer
        brandName={brand.name}
        homeHref={brand.homeHref}
        content={site.footerContent}
        groups={site.footerGroups}
        socialLinks={site.socialLinks}
        newTabLabel={t.footer.social.newTab}
        legalLinks={site.legalLinks}
      />
      <ContactLauncher
        socialLinks={launcherSocialLinks}
        newTabLabel={t.footer.social.newTab}
      />
      <InstantScrollOnNavigate />
      <ScrollRestoration />
    </>
  )
}
