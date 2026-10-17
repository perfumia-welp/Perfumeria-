import { useEffect, useRef } from "react"
import { Outlet, useLocation } from "react-router"
import { useAuth, userNames } from "@/auth/authContext"
import { AccountContext } from "@/components/account/AccountContext"
import AccountNav from "@/components/account/AccountNav"
import Container from "@/components/ui/Container"
import PageIntro from "@/components/ui/PageIntro"
import { useRemoteData } from "@/hooks/useRemoteData"
import usePrefersReducedMotion from "@/hooks/usePrefersReducedMotion"
import { useI18n } from "@/i18n/i18nContext"
import { stripLocale } from "@/i18n/locales"
import { getProfile, listAddresses, listOrders } from "@/services/account"
import type { CustomerProfile } from "@/types/account"
import "./AccountPage.css"

/** Shared protected account shell and a single source for all account data. */
export default function AccountPage() {
  const { pathname } = useLocation()
  const accountContentTopRef = useRef<HTMLDivElement>(null)
  const accountRoute = stripLocale(pathname)
  const previousAccountRoute = useRef(accountRoute)
  const prefersReducedMotion = usePrefersReducedMotion()
  const { user } = useAuth()
  const userId = user?.id ?? ""
  const metadata = userNames(user)
  const fallback: CustomerProfile = {
    firstName: metadata.firstName,
    lastName: metadata.lastName,
    phone: "",
  }
  const profile = useRemoteData(() => getProfile(userId), userId)
  const addresses = useRemoteData(listAddresses, userId)
  const orders = useRemoteData(listOrders, userId)
  const stored = profile.state.status === "ready" ? profile.state.data : null
  const firstName = stored?.firstName || fallback.firstName
  const fullName = [firstName, stored?.lastName || fallback.lastName]
    .filter(Boolean)
    .join(" ")
  const { t } = useI18n()

  useEffect(() => {
    if (previousAccountRoute.current === accountRoute) return
    previousAccountRoute.current = accountRoute
    accountContentTopRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    })
  }, [accountRoute, prefersReducedMotion])

  return (
    <AccountContext.Provider
      value={{
        userId,
        email: user?.email ?? "",
        fallback,
        fullName,
        phone: stored?.phone ?? "",
        profile,
        addresses,
        orders,
      }}
    >
      <div className="account-page">
        <PageIntro intro={t.account.intro(firstName)} />
        <Container className="account-layout">
          <AccountNav />
          <main className="account-content">
            <div
              ref={accountContentTopRef}
              className="account-content__route"
              key={pathname}
            >
              <Outlet />
            </div>
          </main>
        </Container>
      </div>
    </AccountContext.Provider>
  )
}
