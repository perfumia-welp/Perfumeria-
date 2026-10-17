/*
 * Search-engine settings shared by the page metadata (lib/documentMeta.ts),
 * the structured data (lib/seo.ts) and the sitemap script
 * (scripts/seo/generate-sitemap.mjs). Plain values only: the sitemap script
 * imports this file directly with Node.
 */
export const SEO = {
  /**
   * The public site address used in canonical, hreflang, Open Graph and
   * sitemap URLs. ASSUMPTION until the owner confirms the live domain: the
   * company email domain (info@perfumira.com), without "www". If the site goes
   * live on another host (e.g. https://www.perfumira.com), change it here or
   * set VITE_SITE_URL at build time, then regenerate the sitemap.
   */
  siteUrl: "https://perfumira.com",
  /**
   * Brand name in titles and structured data, as written in the owner's SEO
   * strategy, About and FAQ copy, domain and social accounts. The visual
   * wordmark (company.name, "Perfumeria") is a separate, still open decision.
   */
  brand: "Perfumira",
  /** Year the owner's About copy gives for the start of the business. */
  foundingYear: "1997",
  /** Shared social preview image (placeholder until a brand asset arrives). */
  socialImage: "/social-preview.png",
} as const
