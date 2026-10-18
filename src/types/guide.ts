/*
 * Fragrance guides: editorial reference pages at /guides/:slug, rendered by
 * GuidePage from a content module in data/guides/. A guide compares a few
 * entries side by side (the "at a glance" table), gives each entry its own
 * section, then closes with free sections and links back into the shop.
 */

/** A link inside guide copy; `href` is an English app path (AppLink localizes it). */
export interface GuideLink {
  text: string
  href: string
}

/** Runs of text and links, like the FAQ answers. */
export type GuideText = Array<string | GuideLink>

/** One value of an entry, shown in the comparison table and in its section. */
export interface GuideFact {
  /**
   * The approved value as shown. `null` means the owner has not confirmed it
   * yet: the page says so (`chrome.unconfirmed`) instead of guessing a value.
   */
  value: string | null
  /** A smaller qualifier under the value, e.g. "Sometimes 10%–20%". */
  note?: string
}

/** A compared item (a concentration level), with its own section and anchor. */
export interface GuideEntry {
  /** Section anchor, e.g. /guides/perfume-concentration#eau-de-parfum. */
  id: string
  /** Table row name; the section heading (h2) adds the abbreviation. */
  name: string
  /** e.g. "EDP": heading "Eau de Parfum (EDP)". */
  abbreviation?: string
  /** Another name, shown as a small label, e.g. "Pure Perfume". */
  alias?: string
  /** Keyed by `comparison.columns[].key`. */
  facts: Record<string, GuideFact>
  details: string
}

export interface GuideSection {
  id: string
  title: string
  paragraphs: GuideText[]
}

export interface GuideContent {
  slug: string
  /**
   * Copy exists in English only: other-language URLs show it with a notice,
   * declare the English page canonical and carry no hreflang or structured data.
   */
  englishOnly: boolean
  /** `documentTitle` is the full <title>, used as is. */
  seo: { documentTitle: string; description: string }
  /** ISO dates for Article structured data. */
  datePublished: string
  dateModified: string
  eyebrow: string
  /** The page's h1, Article headline and breadcrumb name. */
  title: string
  lead?: string
  comparison: {
    id: string
    title: string
    /** Accessible table caption. */
    caption: string
    /** Heading of the entry-name column. */
    entryLabel: string
    columns: { key: string; label: string }[]
  }
  entries: GuideEntry[]
  sections: GuideSection[]
  explore: {
    id: string
    title: string
    links: GuideLink[]
    help: { text: string; link: GuideLink }
  }
  chrome: {
    /** Right-aligned detail in the page intro. */
    meta: string
    /** Shown in place of a fact the owner has not confirmed yet. */
    unconfirmed: string
  }
}
