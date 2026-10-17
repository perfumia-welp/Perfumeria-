import type { Locale } from "./locales"

/*
 * Arabic typefaces, requested only when Arabic is shown. English keeps
 * Instrument Serif and Inter unchanged; in Arabic those stay first in the
 * font stacks (see styles/rtl.css), so Latin product names and the wordmark
 * still use them and only Arabic letters fall through to these families.
 * index.html adds the same link for a page first opened under /ar.
 */
const ARABIC_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Noto+Naskh+Arabic:wght@400;500;600&display=swap"

export function loadLocaleFonts(locale: Locale) {
  if (locale !== "ar" || document.getElementById("fonts-ar")) return
  const link = document.createElement("link")
  link.id = "fonts-ar"
  link.rel = "stylesheet"
  link.href = ARABIC_FONTS_HREF
  document.head.append(link)
}
