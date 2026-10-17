import { createContext, useContext } from "react"
import type { Direction, Locale } from "./locales"
import type { Messages } from "./messages"

export interface I18nContextValue {
  locale: Locale
  dir: Direction
  /** All messages for the current locale, grouped by namespace. */
  t: Messages
  /** An app path in the current language ("/products" → "/ar/products"). */
  localize: (href: string) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error("useI18n must be used inside <LocaleProvider>")
  return context
}
