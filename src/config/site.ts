/*
 * Search-engine settings shared by the page metadata (lib/documentMeta.ts),
 * the structured data (lib/seo.ts) and the sitemap script
 * (scripts/seo/generate-sitemap.mjs). Plain values only: the sitemap script
 * imports this file directly with Node.
 */
export const SEO = {
  /**
   * The public site address used in canonical, hreflang, Open Graph and
   * sitemap URLs: the owner-confirmed production domain. VITE_SITE_URL, when
   * set at build time, overrides it (Hostinger: VITE_SITE_URL=https://perfumira.net).
   */
  siteUrl: "https://perfumira.net",
  /** Brand name in titles and structured data (owner-confirmed spelling). */
  brand: "Perfumira",
  /** Year the owner's About copy gives for the start of the business. */
  foundingYear: "1997",
  /** Shared social preview image (placeholder until a brand asset arrives). */
  socialImage: "/social-preview.png",
} as const
