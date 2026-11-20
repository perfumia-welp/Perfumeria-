/*
 * GET /api/site-contact: the store's public contact settings
 * (shared/siteContact.mjs), with the phone / WhatsApp number read live from
 * the merchant's Welp business record, the same public record that holds the
 * minimum order (server/orderRules.mjs).
 *
 * Never fails a visitor: a value read from Welp is reused for `ttlMs`
 * (15 min), then read again in the background while the last good value is
 * served; if Welp has never been read (or its number is not valid), the
 * configured defaults are served. After a failed read, `failureCooldownMs`
 * (60 s) passes before Welp is asked again.
 */
import { BUSINESS_URL } from "./orderRules.mjs"
import { buildSiteContact } from "../shared/siteContact.mjs"

const FETCH_TIMEOUT_MS = 8000
export const SITE_CONTACT_TTL_MS = 15 * 60 * 1000
export const SITE_CONTACT_FAILURE_COOLDOWN_MS = 60 * 1000

/** One read of the live business record's `data` (GET only, public, no token). */
export async function fetchBusinessRecord() {
  const response = await fetch(BUSINESS_URL, {
    headers: { "App-ID": "WEBSITE", "Accept-Language": "EN", Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`welp business ${response.status}`)
  const body = await response.json()
  if (body?.data?.id !== 84116) throw new Error("welp business mismatch")
  return body.data
}

/**
 * @param {object} [options]
 * @param {() => Promise<object>} [options.fetchRecord]
 * @param {number} [options.ttlMs]
 * @param {number} [options.failureCooldownMs]
 * @param {() => number} [options.now]
 * @param {(message: string, detail?: object) => void} [options.log]
 */
export function createSiteContact({
  fetchRecord = fetchBusinessRecord,
  ttlMs = SITE_CONTACT_TTL_MS,
  failureCooldownMs = SITE_CONTACT_FAILURE_COOLDOWN_MS,
  now = Date.now,
  log = () => {},
} = {}) {
  let cached = null // { contact, at }
  let failedAt = -Infinity
  let pending = null
  const read = () =>
    (pending ??= (async () => {
      try {
        const contact = buildSiteContact(await fetchRecord())
        if (contact.source.phone !== "welp") log("Site contact: Welp number missing or invalid, using the configured number")
        cached = { contact, at: now() }
        return contact
      } catch (error) {
        failedAt = now()
        log("Site contact: Welp unavailable", { name: error?.name, message: String(error?.message ?? "").slice(0, 80) })
        return null
      } finally {
        pending = null
      }
    })())
  return {
    /** Always resolves: Welp-backed when possible, else the last good value, else the defaults. */
    async get() {
      const fresh = cached && now() - cached.at < ttlMs
      const coolingDown = now() - failedAt < failureCooldownMs
      if (fresh) return cached.contact
      if (cached) {
        if (!coolingDown) void read() // stale-while-revalidate
        return cached.contact
      }
      if (!coolingDown) {
        const contact = await read()
        if (contact) return contact
      }
      return buildSiteContact(null)
    },
  }
}
