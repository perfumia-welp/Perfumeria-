import { useEffect, useMemo, useRef, type MouseEvent } from "react"
import {
  Outlet,
  ScrollRestoration,
  useLocation,
  useMatches,
} from "react-router"
import { findGuide } from "@/data/guides"
import { brand, getSiteNavigation } from "@/data/site"
import { useI18n } from "@/i18n/i18nContext"
import { LOCALE_SEGMENT, localizePath, stripLocale } from "@/i18n/locales"
import type { Messages } from "@/i18n/messages"
import { setDocumentMeta } from "@/lib/documentMeta"
import { formatPrice } from "@/lib/formatPrice"
import { formatSize } from "@/lib/formatSize"
import {
  hasArabicProductContent,
  listingSeo,
  metaExcerpt,
  sitePath,
} from "@/lib/seo"
import {
  COLLECTIONS,
  collectionPath,
  paths,
  type CollectionGender,
} from "@/router/paths"
import NotFoundPage from "@/pages/NotFoundPage"
import { useCatalogState } from "@/hooks/useCatalogState"
import {
  catalogGenders,
  findProductForPage,
  getOptionPriceRange,
  getTitleReference,
} from "@/services/catalog"
import ContactLauncher, { MobileWhatsApp } from "./ContactLauncher"
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
  /** Fragrance guide (/guides/:slug): metadata from its content in data/guides. */
  guide?: boolean
  /** Collection landing page (/men-perfumes): the catalogue for one gender. */
  collection?: CollectionGender
  /** Personal or transactional page (bag, account, sign-in): `noindex`. */
  noindex?: boolean
  /**
   * The page's copy exists in English only (e.g. owner-approved FAQ). Its
   * other-language URL declares the English page as canonical and no
   * hreflang alternates, so it is not presented as a translation.
   */
  englishOnly?: boolean
  /**
   * The Arabic page is not yet an approved translation of the English one
   * (About): the Arabic URL is `noindex` and neither declares hreflang.
   */
  arabicDraft?: boolean
}

interface PageSeo {
  title: string
  description: string
  /** Localized app path (with any kept query), or null for pages without one. */
  canonical: string | null
  /** Whether an equivalent page exists in the other language (hreflang). */
  translated: boolean
  indexable: boolean
  image?: string
}

/** Collections the catalogue really has a category for. */
const collections = COLLECTIONS.filter((gender) =>
  catalogGenders.includes(gender),
)

/** Shared frame for every page: skip link, header, main landmark, footer. */
export default function SiteLayout() {
  const mainRef = useRef<HTMLElement>(null)
  const { pathname, search, hash } = useLocation()
  const matches = useMatches()
  const { t, locale, localize } = useI18n()
  // Product titles follow the live catalogue as it loads.
  const catalog = useCatalogState()
  const previousPage = useRef(stripLocale(pathname))

  const leaf = matches[matches.length - 1]
  const params = leaf?.params ?? {}
  // Only "ar" may precede a page; /fr/products or /en/about are not pages.
  const unknownLanguage =
    params.lang !== undefined && params.lang !== LOCALE_SEGMENT
  // Nested routes (account sections) inherit the handle of their parent.
  const routeHandle: RouteHandle | undefined = unknownLanguage
    ? { page: "notFound" }
    : ([...matches].reverse().find((match) => match.handle)?.handle as
        | RouteHandle
        | undefined)

  // "/faq/" and "/faq" are one page: the canonical never ends in a slash.
  const page = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  const brandTitle = (title: string) => `${title} | ${t.meta.siteTitle}`
  const notFound: PageSeo = {
    title: brandTitle(t.meta.pages.notFound.title),
    description: t.meta.pages.notFound.description,
    canonical: null,
    translated: false,
    indexable: false,
  }

  let seo: PageSeo
  if (routeHandle?.product) {
    const product = findProductForPage(params.slug ?? "", locale)
    if (product) {
      const meta = t.meta.product
      const size =
        product.size && formatSize(product.size, t.common.millilitres)
      const range = getOptionPriceRange(product)
      const amount = (value: number) =>
        formatPrice(value, product.currency, locale)
      const price =
        range && range.min !== range.max
          ? meta.priceFrom(amount(range.min))
          : meta.price(amount(range?.min ?? product.price))
      // Only text written in the page language goes into its description.
      const ownDescription =
        !product.contentLocale || product.contentLocale.description === locale
          ? (product.story?.description ?? "")
          : ""
      const kind = meta.kinds[product.gender ?? "other"]
      const arabicReady = hasArabicProductContent(product)
      seo = {
        title: meta.title(product.name, size, getTitleReference(product)),
        description: metaExcerpt(
          `${meta.summary(product.name, size, kind, price, product.inStock)} ${ownDescription}`,
        ),
        canonical: page,
        translated: arabicReady,
        indexable: locale === "en" || arabicReady,
        image: product.packshot.src,
      }
    } else if (!catalog.complete && !catalog.failed) {
      // Still loading: nothing that would tell a crawler to drop the page.
      seo = {
        title: t.meta.pages.home.documentTitle,
        description: t.meta.siteDescription,
        canonical: page,
        translated: false,
        indexable: true,
      }
    } else seo = notFound
  } else if (routeHandle?.guide) {
    const guide = findGuide(params.slug ?? "")
    // English-only guides follow the FAQ: the English URL is canonical for
    // every language and no hreflang alternates are declared.
    seo = guide
      ? {
          title: guide.seo.documentTitle,
          description: guide.seo.description,
          canonical: guide.englishOnly ? localizePath(page, "en") : page,
          translated: !guide.englishOnly,
          indexable: true,
        }
      : notFound
  } else if (routeHandle?.page && routeHandle.page !== "notFound") {
    const pageMeta = t.meta.pages[routeHandle.page]
    seo = {
      title:
        "documentTitle" in pageMeta
          ? pageMeta.documentTitle
          : brandTitle(pageMeta.title),
      description: pageMeta.description,
      canonical: page,
      translated: true,
      indexable: !routeHandle.noindex,
    }
    if (routeHandle.page === "products" || routeHandle.collection) {
      const listing = listingSeo(search, collections)
      seo.indexable = listing.indexable
      seo.canonical =
        routeHandle.page === "products" && listing.collection
          ? localize(collectionPath(listing.collection as CollectionGender)) +
            listing.canonicalSearch
          : page + listing.canonicalSearch
    }
    if (routeHandle.noindex) seo.translated = false
    if (routeHandle.englishOnly) {
      seo.canonical = localizePath(page, "en")
      seo.translated = false
    }
    if (routeHandle.arabicDraft) {
      seo.translated = false
      if (locale !== "en") seo.indexable = false
    }
  } else seo = notFound

  useEffect(() => {
    const { canonical } = seo
    setDocumentMeta({
      title: seo.title,
      description: seo.description,
      locale,
      indexable: seo.indexable,
      image: seo.image,
      canonicalPath: canonical === null ? null : sitePath(canonical),
      alternates:
        canonical !== null && seo.translated
          ? {
              en: sitePath(localizePath(canonical, "en")),
              ar: sitePath(localizePath(canonical, "ar")),
            }
          : null,
    })
  }, [
    seo.title,
    seo.description,
    seo.canonical,
    seo.translated,
    seo.indexable,
    seo.image,
    locale,
  ])

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

  // Bag and Checkout keep the phone WhatsApp action in the page, below their
  // content, so it never floats over checkout, submit, quantity or remove.
  const sitePage = stripLocale(page)
  const dockWhatsApp = sitePage === paths.cart || sitePage === paths.checkout

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
        {dockWhatsApp && (
          <div className="mobile-whatsapp-dock">
            <MobileWhatsApp docked />
          </div>
        )}
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
        docked={dockWhatsApp}
      />
      <InstantScrollOnNavigate />
      <ScrollRestoration />
    </>
  )
}
