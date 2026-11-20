/* Types for server/siteContact.mjs (vite.config.ts imports it). */
import type { SiteContact } from "../shared/siteContact.mjs"

export declare const SITE_CONTACT_TTL_MS: number
export declare const SITE_CONTACT_FAILURE_COOLDOWN_MS: number
export declare function fetchBusinessRecord(): Promise<Record<string, unknown>>
export declare function createSiteContact(options?: {
  fetchRecord?: () => Promise<Record<string, unknown>>
  ttlMs?: number
  failureCooldownMs?: number
  now?: () => number
  log?: (message: string, detail?: object) => void
}): {
  get(): Promise<
    SiteContact & {
      source: { phone: "welp" | "default"; email: "config"; stores: "config" }
    }
  >
}
