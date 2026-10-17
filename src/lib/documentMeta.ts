/*
 * Per-route document metadata, updated on navigation. index.html carries the
 * defaults for crawlers that do not run JavaScript.
 *
 * Canonical, hreflang and Open Graph URLs use the public site address
 * (config/site.ts, or VITE_SITE_URL) in production builds, so a preview or
 * temporary host never declares itself canonical. The dev server uses its own
 * origin. Which URL is canonical, which pages are indexable and which have a
 * translation is decided per route in SiteLayout (lib/seo.ts holds the rules).
 */

import { SEO } from "@/config/site"
import { ogLocale, type Locale } from "@/i18n/locales"

/** App paths including the deploy base, one per language. */
export interface AlternatePaths {
  en: string
  ar: string
}

export interface DocumentMeta {
  title: string
  description: string
  locale: Locale
  /** App path (with query, if any) including the deploy base, or null for pages without one (404). */
  canonicalPath: string | null
  /** The page in each language; null when the page has no equivalent translation. */
  alternates: AlternatePaths | null
  /** False adds `noindex` (links are still followed). */
  indexable: boolean
  /** Absolute or root-relative image for social previews; the site default when absent. */
  image?: string
}

/** The origin canonical URLs are written with. */
export const siteOrigin = import.meta.env.DEV
  ? window.location.origin
  : (import.meta.env.VITE_SITE_URL || SEO.siteUrl).replace(/\/+$/, "")

/** Absolute URL on the public site for an app path ("/products" → "https://…/products"). */
export const absoluteUrl = (path: string) => new URL(path, siteOrigin).href

function upsertMeta(
  attribute: "name" | "property",
  key: string,
  content: string,
) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  )
  if (!element) {
    element = document.createElement("meta")
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

/** Replaces the hreflang links (en, ar, x-default) or removes them. */
function setAlternates(alternates: AlternatePaths | null) {
  document.head
    .querySelectorAll('link[rel="alternate"][hreflang]')
    .forEach((link) => link.remove())
  if (!alternates) return
  const entries: Array<[string, string]> = [
    ["en", alternates.en],
    ["ar", alternates.ar],
    ["x-default", alternates.en],
  ]
  for (const [hreflang, path] of entries) {
    const link = document.createElement("link")
    link.rel = "alternate"
    link.hreflang = hreflang
    link.href = absoluteUrl(path)
    document.head.append(link)
  }
}

export function setDocumentMeta({
  title,
  description,
  locale,
  canonicalPath,
  alternates,
  indexable,
  image,
}: DocumentMeta) {
  document.title = title
  upsertMeta("name", "description", description)
  upsertMeta(
    "name",
    "robots",
    indexable ? "index, follow, max-image-preview:large" : "noindex, follow",
  )
  upsertMeta("property", "og:title", title)
  upsertMeta("property", "og:description", description)
  upsertMeta("property", "og:locale", ogLocale[locale])
  upsertMeta(
    "property",
    "og:locale:alternate",
    ogLocale[locale === "ar" ? "en" : "ar"],
  )
  upsertMeta(
    "property",
    "og:image",
    absoluteUrl(image ?? `${import.meta.env.BASE_URL}${SEO.socialImage.slice(1)}`),
  )
  setAlternates(canonicalPath === null ? null : alternates)

  let canonical = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  )
  if (canonicalPath === null) {
    canonical?.remove()
    document.head.querySelector('meta[property="og:url"]')?.remove()
    return
  }
  const url = absoluteUrl(canonicalPath)
  if (!canonical) {
    canonical = document.createElement("link")
    canonical.rel = "canonical"
    document.head.append(canonical)
  }
  canonical.href = url
  upsertMeta("property", "og:url", url)
}
