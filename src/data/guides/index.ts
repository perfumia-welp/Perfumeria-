import type { GuideContent } from "../../types/guide.ts"
import { perfumeConcentrationGuide } from "./perfumeConcentration.ts"

/*
 * Every published fragrance guide. A new guide is one content module added
 * here: the /guides/:slug route, page metadata, structured data and the
 * sitemap (scripts/seo/generate-sitemap.mjs) all read this list. There is
 * no /guides hub page until there is more than one guide.
 *
 * Relative imports with .ts extensions: the sitemap script imports this file
 * directly under Node.
 */
export const guides: GuideContent[] = [perfumeConcentrationGuide]

export const findGuide = (slug: string) =>
  guides.find((guide) => guide.slug === slug)
