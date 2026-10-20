import { useEffect, useMemo, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import {
  authRedirectUrl,
  isSupabaseConfigured,
  loadSupabase,
} from "@/lib/supabase"
import { useI18n } from "@/i18n/i18nContext"
import { localizePath } from "@/i18n/locales"
import { paths } from "@/router/paths"
import {
  AuthContext,
  type AuthContextValue,
  type AuthFailure,
  type AuthResult,
  type SignUpDetails,
  type SignUpResult,
} from "./authContext"
import { authErrorCode, linkErrorCode } from "./authErrors"

/*
 * The only place that talks to `supabase.auth`. Supabase stores and refreshes
 * the session itself; this provider mirrors it into React state and turns
 * every call into an AuthResult whose error code the pages translate.
 */

/*
 * Read at import, before Supabase consumes the email-link URL: an expired
 * link arrives as `#error_code=otp_expired&error_description=…`.
 */
function readLinkError() {
  const params = new URLSearchParams(
    window.location.hash.slice(1) || window.location.search,
  )
  return linkErrorCode(
    params.get("error_code"),
    params.get("error_description"),
  )
}

const initialLinkError = readLinkError()

/*
 * Supabase handles a recovery link while the client starts up, which can be
 * before React subscribes below, so the PASSWORD_RECOVERY event is also
 * caught as soon as the client exists. Loading starts here, at app start.
 */
let recoveryDetected = false
const clientReady = loadSupabase()
  .then((client) => {
    client?.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") recoveryDetected = true
    })
    return client
  })
  // A failed chunk download leaves auth unavailable rather than loading forever.
  .catch(() => null)

/*
 * Anonymous guest identity for the bag (supabase/migrations/
 * 20261020090000_anonymous_guests.sql). Started on a guest's first Add to
 * Bag, never on page load; one request at a time. When Supabase refuses
 * (anonymous sign-ins switched off), this visit stops asking and the guest's
 * bag stays in memory for the visit.
 */
let guestRequest: Promise<string | null> | null = null
let guestUnavailable = false

async function requestGuestSession(): Promise<string | null> {
  const supabase = await clientReady
  if (!supabase || guestUnavailable) return null
  try {
    const { data: current } = await supabase.auth.getSession()
    if (current.session) return current.session.user.id
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error || !data.user) throw error ?? new Error("No anonymous user")
    return data.user.id
  } catch (error) {
    guestUnavailable = true
    console.warn(
      "Guest bag: anonymous sign-in is unavailable, so this visitor's bag is kept for this visit only.",
      error,
    )
    return null
  }
}

const notConfigured = { ok: false, error: "not_configured" } as const

const failure = (error: unknown): AuthFailure => ({
  ok: false,
  error: authErrorCode(error),
})

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  /*
   * Email links return to the page in the visitor's current language:
   * /account and /reset-password in English, /ar/account and
   * /ar/reset-password in Arabic. Supabase only follows a redirect that its
   * Redirect URLs allowlist accepts (see FRONTEND_HANDOFF.md).
   */
  const { locale } = useI18n()
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [isRecovery, setIsRecovery] = useState(recoveryDetected)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    clientReady.then((supabase) => {
      if (!supabase || cancelled) return
      const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
        setSession(nextSession)
        if (event === "PASSWORD_RECOVERY" || recoveryDetected) {
          setIsRecovery(true)
        }
        if (event === "SIGNED_OUT") {
          recoveryDetected = false
          setIsRecovery(false)
        }
        // INITIAL_SESSION fires once the stored session or email link is checked.
        setIsLoading(false)
      })
      unsubscribe = () => data.subscription.unsubscribe()
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const redirectTo = (path: string) =>
      authRedirectUrl(localizePath(path, locale))

    const signIn = async (email: string, password: string) => {
      const supabase = await clientReady
      if (!supabase) return notConfigured
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        return error ? failure(error) : { ok: true as const }
      } catch (error) {
        return failure(error)
      }
    }

    const signUp = async ({
      firstName,
      lastName,
      email,
      password,
    }: SignUpDetails): Promise<SignUpResult> => {
      const supabase = await clientReady
      if (!supabase) return notConfigured
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { first_name: firstName.trim(), last_name: lastName.trim() },
            emailRedirectTo: redirectTo(paths.account),
          },
        })
        if (error) return failure(error)
        // With email confirmation on, Supabase hides existing accounts by
        // returning a user with no identities instead of an error.
        if (data.user && data.user.identities?.length === 0) {
          return { ok: false, error: "user_already_exists" }
        }
        return { ok: true, needsConfirmation: !data.session }
      } catch (error) {
        return failure(error)
      }
    }

    const resendConfirmation = async (email: string) => {
      const supabase = await clientReady
      if (!supabase) return notConfigured
      try {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: email.trim(),
          options: { emailRedirectTo: redirectTo(paths.account) },
        })
        return error ? failure(error) : { ok: true as const }
      } catch (error) {
        return failure(error)
      }
    }

    const signOut = async () => {
      const supabase = await clientReady
      if (!supabase) return notConfigured
      try {
        // Local scope ends this browser's session even if the network fails.
        const { error } = await supabase.auth.signOut({ scope: "local" })
        return error ? failure(error) : { ok: true as const }
      } catch (error) {
        return failure(error)
      }
    }

    const requestPasswordReset = async (email: string) => {
      const supabase = await clientReady
      if (!supabase) return notConfigured
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: redirectTo(paths.resetPassword) },
        )
        return error ? failure(error) : { ok: true as const }
      } catch (error) {
        return failure(error)
      }
    }

    const updatePassword = async (password: string) => {
      const supabase = await clientReady
      if (!supabase) return notConfigured
      try {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) return failure(error)
        recoveryDetected = false
        setIsRecovery(false)
        return { ok: true as const }
      } catch (error) {
        return failure(error)
      }
    }

    // An anonymous guest is a visitor everywhere except their bag.
    const customer = session && !session.user.is_anonymous ? session : null

    const startGuestSession = () => {
      guestRequest ??= requestGuestSession().finally(() => {
        guestRequest = null
      })
      return guestRequest
    }

    return {
      user: customer?.user ?? null,
      session: customer,
      bagOwnerId: session?.user.id ?? null,
      startGuestSession,
      isLoading,
      isConfigured: isSupabaseConfigured,
      isRecovery,
      linkError: initialLinkError,
      signIn,
      signUp,
      resendConfirmation,
      signOut,
      requestPasswordReset,
      updatePassword,
    }
  }, [session, isLoading, isRecovery, locale])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
