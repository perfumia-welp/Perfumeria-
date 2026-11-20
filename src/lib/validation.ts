const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_PATTERN = /^\+?[\d\s()-]{6,}$/

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim())
}

/**
 * Lenient check: digits, spaces, brackets and dashes, optional leading +,
 * with at least 7 digits (so "((--))" or "123" are rejected).
 */
export function isValidPhone(value: string) {
  const trimmed = value.trim()
  return PHONE_PATTERN.test(trimmed) && trimmed.replace(/\D/g, "").length >= 7
}

/**
 * Order contact details (checkout, order edit): a complete Egyptian mobile
 * and a complete email, the same rules POST /api/orders applies itself.
 */
export {
  isValidOrderEmail,
  isValidOrderPhone,
} from "../../shared/contactRules.mjs"

/** Matches the minimum set in Supabase → Authentication → Providers → Email. */
export const PASSWORD_MIN_LENGTH = 8
