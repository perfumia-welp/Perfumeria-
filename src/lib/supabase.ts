import type { SupabaseClient } from "@supabase/supabase-js"

/*
 * The single Supabase client. It uses the public publishable key only
 * (sb_publishable_…); row-level security protects the data. Secret keys
 * (sb_secret_…) and the legacy service_role key must never reach the
 * browser, so they never belong in a VITE_ variable.
 *
 * The library is loaded on demand (its own chunk), so pages render without
 * waiting for it. AuthProvider starts loading it as soon as the app starts.
 * Without the two variables there is no client and auth reports itself as
 * not configured instead of failing.
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const isSupabaseConfigured = Boolean(url && publishableKey)

if (!isSupabaseConfigured) {
  console.error(
    "Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local (see .env.example).",
  )
}

let client: Promise<SupabaseClient | null> | undefined

/** The shared client (created once), or null when not configured. */
export function loadSupabase() {
  client ??=
    url && publishableKey
      ? import("@supabase/supabase-js").then(({ createClient }) =>
          createClient(url, publishableKey),
        )
      : Promise.resolve(null)
  return client
}

/** Absolute URL for a route, including Vite's deploy base path, for auth email links. */
export function authRedirectUrl(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "")
  return `${window.location.origin}${base}${path}`
}
