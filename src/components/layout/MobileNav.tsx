import { useLocation } from "react-router"
import { useI18n } from "@/i18n/i18nContext"
import type { NavigationItem } from "@/types/content"
import AppLink from "../ui/AppLink"
import Icon from "../ui/Icon"
import IconButton from "../ui/IconButton"
import Sheet from "../ui/Sheet"
import LanguageSwitch from "./LanguageSwitch"
import "./MobileNav.css"

/** Matches the width at which the desktop navigation becomes visible (see Header.css). */
const DESKTOP_NAV_QUERY = "(min-width: 1024px)"

/** Full-screen navigation for tablet and mobile. */
export default function MobileNav({
  id,
  open,
  onClose,
  brandName,
  homeHref,
  navigation,
}: {
  id: string
  open: boolean
  onClose: () => void
  brandName: string
  homeHref: string
  navigation: NavigationItem[]
}) {
  const { pathname } = useLocation()
  const { t, localize } = useI18n()

  return (
    <Sheet
      id={id}
      open={open}
      onClose={onClose}
      label={t.navigation.menu}
      variant="fullscreen"
      className="mobile-nav"
      closeWhen={DESKTOP_NAV_QUERY}
    >
      {(close) => (
        <>
          <div className="mobile-nav__bar">
            <AppLink
              href={homeHref}
              className="site-logo"
              aria-label={t.navigation.brandHome(brandName)}
              onClick={close}
            >
              {brandName}
            </AppLink>
            <IconButton
              icon="close"
              label={t.navigation.close}
              onClick={close}
            />
          </div>

          <nav className="mobile-nav__body" aria-label={t.navigation.main}>
            <ul>
              {navigation.map((item) => (
                <li key={item.label}>
                  <AppLink
                    href={item.href}
                    aria-current={
                      item.href && localize(item.href) === pathname
                        ? "page"
                        : undefined
                    }
                    onClick={close}
                  >
                    <span>{item.label}</span>
                    <Icon name="arrow" />
                  </AppLink>
                </li>
              ))}
            </ul>
            <LanguageSwitch className="mobile-nav__language" onSwitch={close} />
          </nav>
        </>
      )}
    </Sheet>
  )
}
