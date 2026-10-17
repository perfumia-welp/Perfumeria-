import { Fragment } from "react"
import { Link, useLocation } from "react-router"
import { useI18n } from "@/i18n/i18nContext"
import {
  LOCALES,
  localeLabels,
  localeNames,
  localizePath,
  saveLocalePreference,
} from "@/i18n/locales"
import "./LanguageSwitch.css"

interface LanguageSwitchProps {
  className?: string
  /** Called after a language is chosen, e.g. to close the mobile menu. */
  onSwitch?: () => void
}

/**
 * EN | AR. Each label is a real link to the current page in that language,
 * with the query and hash kept (/products?sort=name ↔ /ar/products?sort=name),
 * so the URL stays the source of truth and both versions are crawlable.
 * The page stays mounted and the scroll position is kept; the bag, wishlist
 * and session live above the router and are untouched.
 */
export default function LanguageSwitch({
  className,
  onSwitch,
}: LanguageSwitchProps) {
  const { locale, t } = useI18n()
  const { pathname, search, hash } = useLocation()

  return (
    <div
      className={["language-switch", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={t.navigation.language}
    >
      {LOCALES.map((target, index) => (
        <Fragment key={target}>
          {index > 0 && (
            <span className="language-switch__divider" aria-hidden="true">
              |
            </span>
          )}
          <Link
            to={localizePath(pathname, target) + search + hash}
            lang={target}
            hrefLang={target}
            aria-label={`${localeNames[target]} (${localeLabels[target]})`}
            aria-current={target === locale ? "true" : undefined}
            preventScrollReset
            onClick={() => {
              saveLocalePreference(target)
              onSwitch?.()
            }}
          >
            {localeLabels[target]}
          </Link>
        </Fragment>
      ))}
    </div>
  )
}
