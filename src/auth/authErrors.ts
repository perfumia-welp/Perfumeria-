import type { AuthError } from "@supabase/supabase-js"
import type { Messages, Translatable } from "@/i18n/messages"

/*
 * Supabase auth errors, reduced to the codes the site has messages for
 * (auth.errors in each language). Unknown codes fall back to `general`.
 * The code is kept rather than text so a message already on screen is shown
 * in the new language after a switch.
 */

export type AuthErrorCode = keyof Messages["auth"]["errors"]

/** Supabase codes with their own message. */
const SUPABASE_CODES = [
  "invalid_credentials",
  "email_not_confirmed",
  "user_already_exists",
  "weak_password",
  "same_password",
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "email_address_invalid",
  "signup_disabled",
  "email_provider_disabled",
  "user_banned",
  "session_expired",
  "otp_expired",
  "request_timeout",
] satisfies AuthErrorCode[]

/** Supabase codes that share another code's message. */
const ALIASES: Record<string, AuthErrorCode> = {
  email_exists: "user_already_exists",
  session_not_found: "session_expired",
}

function knownCode(code: string | null | undefined): AuthErrorCode | null {
  if (!code) return null
  if (ALIASES[code]) return ALIASES[code]
  return (SUPABASE_CODES as string[]).includes(code)
    ? code as AuthErrorCode
    : null
}

/** The visitor-facing message for a code, in the language shown. */
export const authErrorText = (code: AuthErrorCode): Translatable => (t) =>
  t.auth.errors[code]

/**
 * Same test as supabase-js's isAuthError, kept local so this module does not
 * pull the Supabase library into the main bundle.
 */
function isAuthError(error: unknown): error is AuthError {
  return typeof error === "object" && error !== null && "__isAuthError" in error
}

export function authErrorCode(error: unknown): AuthErrorCode {
  if (isAuthError(error)) {
    const code = knownCode(error.code)
    if (code) return code
    if (error.status === 429) return "over_request_rate_limit"
    if (error.status === 0) return "network"
  }
  if (error instanceof TypeError) return "network"
  return "general"
}

/** Error passed back in an email link (`#error_code=otp_expired&…`). */
export function linkErrorCode(
  code: string | null,
  description: string | null,
): AuthErrorCode | null {
  return knownCode(code) ?? (description ? "link_invalid" : null)
}
