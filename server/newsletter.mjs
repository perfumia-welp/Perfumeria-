/*
 * Newsletter sign-up: validation and the call to the subscriber list.
 *
 * server/app.mjs wires these to POST /api/newsletter. The list lives in
 * Supabase (public.newsletter_subscribers, migration 20261022120000), which
 * visitors can only add to through the subscribe_newsletter() function; this
 * server calls it with the same public (publishable) key the website uses,
 * so no secret key is needed or stored.
 *
 * Nothing is emailed when someone subscribes, and no IP address is stored
 * (the rate limit counts in memory only).
 */
import { HONEYPOT_FIELD, LOCALES } from "./contact.mjs"

/** Same rule as src/lib/validation.ts and the database function. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const EMAIL_MAX = 254

/** The only answers the subscriber list gives. */
export const NEWSLETTER_RESULTS = ["subscribed", "already_subscribed"]

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value)

/**
 * Checks a request body. Returns `{ ok: true, value: { email, locale } }`, or
 * `{ ok: false, error }` with "invalid_request" (malformed body or the
 * honeypot) or "validation" (`fields` names the invalid fields).
 */
export function validateNewsletter(body) {
  if (!isPlainObject(body)) return { ok: false, error: "invalid_request" }
  for (const key of ["email", "locale", HONEYPOT_FIELD]) {
    const field = body[key]
    if (field !== undefined && field !== null && typeof field !== "string")
      return { ok: false, error: "invalid_request" }
  }
  // Filled in: almost certainly an automated submission.
  if ((body[HONEYPOT_FIELD] ?? "").trim())
    return { ok: false, error: "invalid_request" }

  const email = (body.email ?? "").trim()
  const locale = (body.locale ?? "").trim() || "en"
  const fields = []
  if (!email || email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email))
    fields.push("email")
  if (!LOCALES.includes(locale)) fields.push("locale")
  if (fields.length) return { ok: false, error: "validation", fields }
  return { ok: true, value: { email, locale } }
}

/** Thrown by the list client; `code` is safe to log, never shown to visitors. */
export class NewsletterError extends Error {
  constructor(code, detail = {}) {
    super(code)
    this.code = code
    this.detail = detail
  }
}

/**
 * Subscriber list client for the Supabase REST API: calls
 * subscribe_newsletter() and returns "subscribed" or "already_subscribed".
 * Throws NewsletterError("invalid_email") when the database rejects the
 * address and NewsletterError("subscribe_failed") for anything else.
 */
export function supabaseNewsletter({
  url,
  publishableKey,
  fetch: fetchImpl = fetch,
  timeoutMs = 10000,
}) {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/rpc/subscribe_newsletter`
  return async function subscribe({ email, locale }) {
    let response
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          p_email: email,
          p_locale: locale,
          p_source: "footer",
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new NewsletterError("subscribe_failed", { name: error?.name })
    }

    const data = await response.json().catch(() => undefined)
    if (response.ok && NEWSLETTER_RESULTS.includes(data)) return data
    // Raised by the function for an address it does not accept.
    if (data?.code === "22023" && data?.message === "invalid_email")
      throw new NewsletterError("invalid_email")
    throw new NewsletterError("subscribe_failed", {
      status: response.status,
      code: data?.code,
    })
  }
}
