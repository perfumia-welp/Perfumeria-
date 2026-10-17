import en from "./en"
import type { Locale } from "./locales"

/*
 * Message registry. English ships with the app; Arabic is its own chunk,
 * loaded by the root route loader before any /ar page renders, so English
 * visitors never download it.
 */

/** Every locale implements the English shape (checked in ar/index.ts). */
export type Messages = typeof en

/**
 * Text that is translated when it is shown rather than when it is created,
 * so a status message stays correct if the visitor switches language.
 */
export type Translatable = (t: Messages) => string

const loaded: Partial<Record<Locale, Messages>> = { en }
let arabic: Promise<Messages> | undefined

export function loadMessages(locale: Locale): Promise<Messages> {
  const ready = loaded[locale]
  if (ready) return Promise.resolve(ready)
  arabic ??= import("./ar").then((module) => {
    loaded.ar = module.default
    return module.default
  })
  return arabic
}

export const hasMessages = (locale: Locale) => Boolean(loaded[locale])

/** Messages for a locale, or English while that locale is still loading. */
export const getMessages = (locale: Locale): Messages => loaded[locale] ?? en
