import {
  buildSiteContact,
  parseSiteContact,
  type SiteContact,
} from "../../shared/siteContact.mjs"

export type { SiteContact, SiteStore } from "../../shared/siteContact.mjs"

/**
 * The configured contact settings (shared/siteContact.mjs), shown until the
 * server's answer arrives and kept when it cannot be read.
 */
export const DEFAULT_SITE_CONTACT: SiteContact = buildSiteContact(null)

/**
 * GET /api/site-contact (server/siteContact.mjs): the number from Welp, the
 * rest from the server's settings. Throws when it cannot be read or the
 * answer is malformed; the caller keeps the defaults.
 */
export async function fetchSiteContact(): Promise<SiteContact> {
  const response = await fetch(`${import.meta.env.BASE_URL}api/site-contact`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`site contact ${response.status}`)
  const contact = parseSiteContact(await response.json())
  if (!contact) throw new Error("site contact invalid")
  return contact
}
