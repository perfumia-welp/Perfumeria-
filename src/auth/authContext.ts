import { createContext, useContext } from "react"
import type { Session, User } from "@supabase/supabase-js"
import type { AuthErrorCode } from "./authErrors"

/*
 * Outcomes of auth requests. `error` is a code with a message in every
 * language (auth.errors), shown with authErrorText().
 * Named interfaces rather than inline object types: oxfmt 0.2.0 mangles
 * single-line object types.
 */
export interface AuthSuccess {
  ok: true
}

export interface AuthFailure {
  ok: false
  error: AuthErrorCode
}

export type AuthResult = AuthSuccess | AuthFailure

/**
 * Sign-up can succeed without a session when Supabase requires email
 * confirmation; `needsConfirmation` says the visitor must check their inbox.
 */
export interface SignUpSuccess {
  ok: true
  needsConfirmation: boolean
}

export type SignUpResult = SignUpSuccess | AuthFailure

export interface SignUpDetails {
  firstName: string
  lastName: string
  email: string
  password: string
}

export interface AuthContextValue {
  /**
   * The signed-in customer. Null for visitors, including anonymous guests:
   * a guest has a Supabase identity for their bag only and is never treated
   * as signed in (header, account pages, checkout history).
   */
  user: User | null
  /** The customer's session; null for visitors and anonymous guests. */
  session: Session | null
  /** Supabase user id that owns the bag: the customer's or the guest's. */
  bagOwnerId: string | null
  /**
   * Gives a visitor an anonymous guest identity for their bag (or returns
   * the existing one). Null when anonymous sign-ins are unavailable.
   */
  startGuestSession: () => Promise<string | null>
  /** True until the stored session (or an email link) has been checked. */
  isLoading: boolean
  /** False when the Supabase environment variables are missing. */
  isConfigured: boolean
  /** True after a password-recovery link created a session. */
  isRecovery: boolean
  /** An error carried back by an expired or invalid email link. */
  linkError: AuthErrorCode | null
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (details: SignUpDetails) => Promise<SignUpResult>
  resendConfirmation: (email: string) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
  requestPasswordReset: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>")
  return context
}

/** Name fields saved as user metadata at sign-up. */
export function userNames(user: User | null) {
  const metadata = user?.user_metadata ?? {}
  const firstName =
    typeof metadata.first_name === "string" ? metadata.first_name.trim() : ""
  const lastName =
    typeof metadata.last_name === "string" ? metadata.last_name.trim() : ""
  return {
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" "),
  }
}
