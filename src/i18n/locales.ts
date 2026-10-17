/*
 * Supported languages and their URLs. English is the default and has no
 * prefix (/products); Arabic lives under /ar (/ar/products). The URL is the
 * source of truth for the language: nothing redirects between them.
 */

export const LOCALES = ["en", "ar"] as const

export type Locale = typeof LOCALES[number]

export const DEFAULT_LOCALE: Locale = "en"

/** URL segment that selects a non-default locale (the `:lang` route param). */
export const LOCALE_SEGMENT = "ar"

export type Direction = "ltr" | "rtl"

export const localeDirection = (locale: Locale): Direction =>
  locale === "ar" ? "rtl" : "ltr"

/** BCP 47 tags for Intl. Arabic keeps Latin digits and the Gregorian calendar. */
export const intlLocale: Record<Locale, string> = {
  en: "en-US",
  ar: "ar-u-nu-latn",
}

/** Dates were already formatted day-first ("28 September 2026") in English. */
export const intlDateLocale: Record<Locale, string> = {
  en: "en-GB",
  ar: "ar-u-ca-gregory-nu-latn",
}

/** Open Graph locale codes. */
export const ogLocale: Record<Locale, string> = {
  en: "en_US",
  ar: "ar_AR",
}

/** Each language's own name, used for the switcher's accessible names. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
}

/** Short visible switcher labels. */
export const localeLabels: Record<Locale, string> = {
  en: "EN",
  ar: "AR",
}

/** The locale selected by a `:lang` route param (undefined = default). */
export const localeFromParam = (lang: string | undefined): Locale =>
  lang === LOCALE_SEGMENT ? "ar" : DEFAULT_LOCALE

/** Locale of an app path without the deploy base ("/ar/products" → "ar"). */
export const localeFromPath = (pathname: string): Locale =>
  /^\/ar(\/|$)/.test(pathname) ? "ar" : DEFAULT_LOCALE

/** Splits "/products?gender=women#top" into the path and the rest. */
function splitHref(href: string) {
  const index = href.search(/[?#]/)
  return index === -1 ? [href, ""] : [href.slice(0, index), href.slice(index)]
}

/** "/ar/products" → "/products" (query and hash kept). */
export function stripLocale(href: string) {
  const [pathname, rest] = splitHref(href)
  return (pathname.replace(/^\/ar(?=\/|$)/, "") || "/") + rest
}

/**
 * The same page in another language, keeping the query and hash:
 * ("/products?sort=name", "ar") → "/ar/products?sort=name". Anything that is
 * not an app path (anchors, mailto:, external URLs) is returned unchanged.
 */
export function localizePath(href: string, locale: Locale) {
  if (!href.startsWith("/") || href.startsWith("//")) return href
  const [pathname, rest] = splitHref(stripLocale(href))
  if (locale === DEFAULT_LOCALE) return pathname + rest
  return (pathname === "/" ? "/ar" : `/ar${pathname}`) + rest
}

const PREFERENCE_KEY = "perfumeria:locale"

/**
 * Remembers the visitor's last explicit choice. It is a convenience only:
 * an opened URL always decides the language, so nothing reads this to
 * redirect. Storage may be unavailable (private mode); that is fine.
 */
export function saveLocalePreference(locale: Locale) {
  try {
    window.localStorage.setItem(PREFERENCE_KEY, locale)
  } catch {
    // Not remembered for this visit; the URL still carries the language.
  }
}

export function readLocalePreference(): Locale | null {
  try {
    const stored = window.localStorage.getItem(PREFERENCE_KEY)
    return stored === "en" || stored === "ar" ? stored : null
  } catch {
    return null
  }
}
