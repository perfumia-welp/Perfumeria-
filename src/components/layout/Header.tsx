import { useEffect, useState } from "react"
import { useLocation } from "react-router"
import { useAuth } from "@/auth/authContext"
import { useBag } from "@/cart/bagContext"
import { useI18n } from "@/i18n/i18nContext"
import { paths } from "@/router/paths"
import type { NavigationItem } from "@/types/content"
import AppLink from "../ui/AppLink"
import IconButton from "../ui/IconButton"
import LanguageSwitch from "./LanguageSwitch"
import SearchOverlay from "../search/SearchOverlay"
import MobileNav from "./MobileNav"
import "./Header.css"

const MOBILE_NAV_ID = "mobile-navigation"
const SEARCH_ID = "site-search"

export default function Header({
  brandName,
  homeHref,
  accountHref,
  cartHref,
  navigation,
}: {
  brandName: string
  homeHref: string
  accountHref: string
  cartHref: string
  navigation: NavigationItem[]
}) {
  const { itemCount } = useBag()
  const { user, isLoading } = useAuth()
  const { t, localize } = useI18n()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const updateScrolledState = () => setScrolled(window.scrollY > 0)

    updateScrolledState()
    window.addEventListener("scroll", updateScrolledState, { passive: true })
    return () => window.removeEventListener("scroll", updateScrolledState)
  }, [])

  return (
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <AppLink
        href={homeHref}
        className="site-logo"
        aria-label={t.navigation.brandHome(brandName)}
      >
        {brandName}
      </AppLink>

      <nav className="main-nav" aria-label={t.navigation.main}>
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
              >
                {item.label}
              </AppLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="header-actions">
        <LanguageSwitch className="header-language" />
        <IconButton
          icon="search"
          label={t.navigation.search}
          aria-haspopup="dialog"
          aria-expanded={searchOpen}
          aria-controls={SEARCH_ID}
          onClick={() => setSearchOpen(true)}
        />
        {/*
          Follows the live auth state: icon + Account when signed in, the
          words Sign In alone (on every screen size) when not. While Supabase
          restores a stored session the control is held invisible (the link
          still leads to Account, whose guard waits too) so neither state
          flashes before the session is known.
        */}
        {user || isLoading ? (
          <IconButton
            icon="account"
            label={t.navigation.account}
            href={accountHref}
            className="header-account"
            aria-busy={isLoading || undefined}
          />
        ) : (
          <IconButton
            label={t.navigation.signIn}
            href={paths.signIn}
            className="header-account"
            alwaysShowLabel
          />
        )}
        <IconButton
          href={cartHref}
          icon="bag"
          label={t.navigation.bag}
          badge={itemCount}
          aria-label={t.navigation.bagLabel(itemCount)}
        />
        <IconButton
          icon="menu"
          label={t.navigation.menu}
          className="menu-toggle"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls={MOBILE_NAV_ID}
          onClick={() => setMenuOpen(true)}
        />
      </div>

      <SearchOverlay
        id={SEARCH_ID}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      <MobileNav
        id={MOBILE_NAV_ID}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        brandName={brandName}
        homeHref={homeHref}
        navigation={navigation}
      />
    </header>
  )
}
