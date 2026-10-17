import { intlLocale, type Locale } from "@/i18n/locales"

const formatters = new Map<string, Intl.NumberFormat>()

/** Left-to-right mark (U+200E). */
const LRM = String.fromCharCode(0x200e)

/**
 * Formats a price, keeping cents only when the amount has them: "$138" in
 * English, "138 US$" in Arabic. The amount and currency never change with
 * the language, only how they are written.
 */
export function formatPrice(
  amount: number,
  currency: string,
  locale: Locale = "en",
) {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2
  const key = `${locale}-${currency}-${fractionDigits}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(intlLocale[locale], {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    formatters.set(key, formatter)
  }
  const text = formatter.format(amount)
  // Arabic: a trailing left-to-right mark keeps "US$" together; without it
  // the bidi algorithm moves the "$" to the far end ("$US 138").
  return locale === "ar" ? text + LRM : text
}
