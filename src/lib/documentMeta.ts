/*
 * Per-route document metadata, updated on navigation. index.html carries the
 * defaults for crawlers that do not run JavaScript.
 *
 * Canonical and hreflang URLs are built from the current origin, so no
 * production domain is hard-coded: on the live domain they are that domain's
 * URLs. Query strings (filters, sort, search) are left out so filtered views
 * share one canonical. Each page declares its English and Arabic versions
 * (hreflang="en" / "ar", with English as x-default); pages without a
 * canonical (404s) declare none. Indexing itself stays off until launch
 * (robots in .figma/make/site.json).
 */

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
  /** App path including the deploy base, or null for pages without one (404). */
  canonicalPath: string | null
  /** The page in each language; null whenever there is no canonical. */
  alternates: AlternatePaths | null
}

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

const absolute = (path: string) => new URL(path, window.location.origin).href

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
    link.href = absolute(path)
    document.head.append(link)
  }
}

export function setDocumentMeta({
  title,
  description,
  locale,
  canonicalPath,
  alternates,
}: DocumentMeta) {
  document.title = title
  upsertMeta("name", "description", description)
  upsertMeta("property", "og:title", title)
  upsertMeta("property", "og:description", description)
  upsertMeta("property", "og:locale", ogLocale[locale])
  upsertMeta(
    "property",
    "og:locale:alternate",
    ogLocale[locale === "ar" ? "en" : "ar"],
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
  const url = absolute(canonicalPath)
  if (!canonical) {
    canonical = document.createElement("link")
    canonical.rel = "canonical"
    document.head.append(canonical)
  }
  canonical.href = url
  upsertMeta("property", "og:url", url)
}
