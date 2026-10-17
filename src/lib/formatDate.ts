import { intlDateLocale, type Locale } from "@/i18n/locales"

const formatters = new Map<Locale, Intl.DateTimeFormat>()

/**
 * "2026-09-28" → "28 September 2026" / "28 سبتمبر 2026" (parsed as a
 * calendar date, no time zone shift).
 */
export function formatDate(isoDate: string, locale: Locale = "en") {
  let formatter = formatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(intlDateLocale[locale], {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    formatters.set(locale, formatter)
  }
  const [year, month, day] = isoDate.split("-").map(Number)
  return formatter.format(new Date(year, month - 1, day))
}
