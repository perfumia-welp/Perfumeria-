import type { Locale } from "@/i18n/locales"

/*
 * Newsletter adapter: posts the address to the site's own server
 * (server.mjs, POST /api/newsletter), which adds it to the private subscriber
 * list in Supabase. The browser never talks to the list directly and never
 * sees anyone else's address.
 *
 * Results: "subscribed" = added (or re-subscribed); "alreadySubscribed" = the
 * address was already on the list; "invalid" = the server did not accept the
 * address; "unavailable" = no newsletter API on this host (e.g. the static
 * preview) or the list is not configured; "rateLimited" = too many attempts
 * in a short time; "error" = it was not saved. Server error text is never
 * shown to visitors.
 */

export interface NewsletterSubmission {
  email: string
  locale: Locale
  /** The hidden spam trap; real visitors leave it empty. */
  nectar: string
}

export type NewsletterResult =
  | { status: "subscribed" }
  | { status: "alreadySubscribed" }
  | { status: "invalid" }
  | { status: "unavailable" }
  | { status: "rateLimited" }
  | { status: "error" }

const TIMEOUT_MS = 20000
const endpoint = `${import.meta.env.BASE_URL}api/newsletter`

export async function subscribeToNewsletter(
  submission: NewsletterSubmission,
): Promise<NewsletterResult> {
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(submission),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    console.error("Newsletter sign-up could not be sent", error)
    return { status: "error" }
  }

  // A host without the API answers with a 404/405 or the app's HTML page.
  const isJson = response.headers
    .get("Content-Type")
    ?.includes("application/json")
  if (!isJson || response.status === 404 || response.status === 405)
    return { status: "unavailable" }

  if (response.ok) {
    const body = (await response.json().catch(() => null)) as {
      status?: string
    } | null
    if (body?.status === "subscribed") return { status: "subscribed" }
    if (body?.status === "already_subscribed")
      return { status: "alreadySubscribed" }
    return { status: "error" }
  }
  if (response.status === 400) {
    const body = (await response.json().catch(() => null)) as {
      fields?: string[]
    } | null
    if (body?.fields?.includes("email")) return { status: "invalid" }
    return { status: "error" }
  }
  if (response.status === 503) return { status: "unavailable" }
  if (response.status === 429) return { status: "rateLimited" }
  return { status: "error" }
}
