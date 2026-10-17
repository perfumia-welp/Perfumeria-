import {
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import type { createBrowserRouter } from "react-router"
import { loadLocaleFonts } from "./fonts"
import { I18nContext } from "./i18nContext"
import {
  localeDirection,
  localeFromParam,
  localizePath,
  type Locale,
} from "./locales"
import { getMessages, hasMessages } from "./messages"

type AppRouter = ReturnType<typeof createBrowserRouter>

/**
 * The language of the committed route (its `:lang` param). The router only
 * commits a navigation after the root loader has loaded that language's
 * messages, so a locale is never reported before its text exists.
 */
function routeLocale(router: AppRouter): Locale {
  const { matches } = router.state
  const locale = localeFromParam(matches[matches.length - 1]?.params.lang)
  return hasMessages(locale) ? locale : "en"
}

/*
 * Sits above the router (like the auth, bag and wishlist providers) so their
 * announcements are translated too. It follows the router's state rather
 * than the URL, and sets <html lang dir> before the browser paints.
 */
export default function LocaleProvider({
  router,
  children,
}: {
  router: AppRouter
  children: ReactNode
}) {
  const locale = useSyncExternalStore(router.subscribe, () =>
    routeLocale(router),
  )
  const dir = localeDirection(locale)

  useLayoutEffect(() => {
    const root = document.documentElement
    root.lang = locale
    root.dir = dir
    loadLocaleFonts(locale)
  }, [locale, dir])

  const value = useMemo(
    () => ({
      locale,
      dir,
      t: getMessages(locale),
      localize: (href: string) => localizePath(href, locale),
    }),
    [locale, dir],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
