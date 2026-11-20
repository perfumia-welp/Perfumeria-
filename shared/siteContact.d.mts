/* Types for shared/siteContact.mjs (the storefront imports it from TypeScript). */

export interface LocalizedText {
  en: string
  ar: string
}

export interface SiteStore {
  id: string
  name: LocalizedText
  address: LocalizedText
  /** https link, or "" when the store has none. */
  mapUrl: string
}

export interface SiteContact {
  email: string
  /** "+20XXXXXXXXXX" */
  whatsapp: string
  /** "+20 127 816 6686" */
  phoneDisplay: string
  phoneHref: string
  stores: SiteStore[]
}

export declare const SITE_CONTACT_DEFAULTS: Readonly<{
  email: string
  whatsapp: string
  stores: readonly Readonly<SiteStore>[]
}>
export declare function normalizeEgyptMobile(raw: unknown): string | null
export declare function formatPhoneDisplay(number: string): string
export declare function phoneHref(number: string): string
export declare function buildSiteContact(
  record: Record<string, unknown> | null,
  defaults?: typeof SITE_CONTACT_DEFAULTS,
): SiteContact & {
  source: { phone: "welp" | "default"; email: "config"; stores: "config" }
}
export declare function parseSiteContact(body: unknown): SiteContact | null
