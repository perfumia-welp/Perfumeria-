import { useEffect, useRef, type ReactNode } from "react"
import { Navigate, useLocation } from "react-router"
import Container from "@/components/ui/Container"
import { useI18n } from "@/i18n/i18nContext"
import { paths } from "@/router/paths"
import { useAuth } from "./authContext"
import "@/pages/AuthPage.css"

/** Where a guarded page sends visitors, so sign-in can return them there. */
export interface AuthRedirectState {
  from?: string
}

/**
 * Route guard: waits quietly while Supabase restores the session, then shows
 * the page or sends the visitor to sign in. If the visitor signs out while
 * the page is open, they go to the homepage instead.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  const wasSignedIn = useRef(false)
  const { t, localize } = useI18n()

  useEffect(() => {
    if (user) wasSignedIn.current = true
  }, [user])

  if (isLoading) {
    return (
      <Container className="auth-loading">
        <p className="eyebrow" role="status">
          {t.auth.opening}
        </p>
      </Container>
    )
  }

  if (!user) {
    if (wasSignedIn.current)
      return <Navigate to={localize(paths.home)} replace />
    const state: AuthRedirectState = {
      from: location.pathname + location.search,
    }
    return <Navigate to={localize(paths.signIn)} replace state={state} />
  }

  return children
}
