import type { Locale } from "@/i18n/locales"
import type { ContactTopic } from "@/router/paths"
import type { ContactFormValues } from "@/types/commerce"

/*
 * Contact message adapter: posts the form to the site's own server
 * (server.mjs, POST /api/contact), which emails it to the store through the
 * store mailbox. No mail settings or passwords ever reach the browser.
 *
 * Results: "success" = the store's mail server accepted the message;
 * "unavailable" = no mail API on this host (e.g. the static preview) or mail
 * is not configured; "rateLimited" = too many messages in a short time;
 * "error" = it was not sent. Server error text is never shown to visitors.
 */

export interface ContactSubmission extends ContactFormValues {
  topic: ContactTopic | null
  locale: Locale
  /** The hidden spam trap; real visitors leave it empty. */
  nectar: string
}

export type ContactResult =
  | { status: "success" }
  | { status: "unavailable" }
  | { status: "rateLimited" }
  | { status: "error" }

const TIMEOUT_MS = 30000
const endpoint = `${import.meta.env.BASE_URL}api/contact`

export async function sendContactMessage(
  submission: ContactSubmission,
): Promise<ContactResult> {
  const { topic, ...rest } = submission
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        ...rest,
        ...(topic ? { topic } : {}),
        pageUrl: window.location.href,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    console.error("Contact message could not be sent", error)
    return { status: "error" }
  }

  // A host without the API answers with a 404/405 or the app's HTML page.
  const isJson = response.headers
    .get("Content-Type")
    ?.includes("application/json")
  if (!isJson || response.status === 404 || response.status === 405)
    return { status: "unavailable" }

  if (response.ok) return { status: "success" }
  if (response.status === 503) return { status: "unavailable" }
  if (response.status === 429) return { status: "rateLimited" }
  return { status: "error" }
}
