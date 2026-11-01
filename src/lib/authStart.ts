/*
 * What can be known about a visitor's session without loading supabase-js,
 * so a visitor with no session never downloads it (see AuthProvider).
 */

/** Where supabase-js keeps the session: its default key, passed to it explicitly. */
export function authStorageKey(supabaseUrl: string) {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`
  } catch {
    return ""
  }
}

/** URL parameters of an email link (confirmation, recovery, expired link). */
const LINK_PARAMS = [
  "access_token",
  "refresh_token",
  "token_hash",
  "code",
  "error",
  "error_code",
  "error_description",
]

/** Whether this URL carries an email link for Supabase to consume. */
export function hasAuthLinkParams(hash: string, search: string) {
  const fragment = new URLSearchParams(hash.replace(/^#/, ""))
  const query = new URLSearchParams(search)
  return LINK_PARAMS.some((name) => fragment.has(name) || query.has(name))
}

/** Whether this browser holds a session. Blocked storage cannot hold one. */
export function hasStoredSession(storageKey: string) {
  try {
    return Boolean(storageKey && window.localStorage.getItem(storageKey))
  } catch {
    return false
  }
}
