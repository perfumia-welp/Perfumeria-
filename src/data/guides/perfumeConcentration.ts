import type { GuideContent } from "../../types/guide.ts"
import { paths } from "../../router/paths.ts"

/*
 * Perfume Concentration Guide: owner-approved educational copy (English
 * only, supplied 2026-10-18). Facts, ranges and sentences are kept as
 * supplied; the only edit is the spelling "dabers" → "dabbers". Headings,
 * table labels and link labels are page structure, not new claims.
 *
 * Do not add facts, percentages or longevity figures that the owner has not
 * approved, and do not machine-translate this copy.
 */
export const perfumeConcentrationGuide: GuideContent = {
  slug: "perfume-concentration",
  englishOnly: true,
  seo: {
    documentTitle:
      "Perfume Concentration Guide: Parfum vs EDP vs EDT | Perfumira",
    description:
      "Compare Extrait de Parfum, Eau de Parfum and Eau de Toilette by oil concentration and typical longevity, and learn why perfume longevity varies.",
  },
  // Set datePublished to the launch date when the guide goes live.
  datePublished: "2026-10-18",
  dateModified: "2026-10-18",
  eyebrow: "Fragrance Guide",
  title: "Perfume Concentration Guide",
  comparison: {
    id: "at-a-glance",
    title: "Concentration levels at a glance",
    caption:
      "Perfume concentration levels compared by oil concentration and longevity",
    entryLabel: "Concentration",
    columns: [
      { key: "oil", label: "Oil concentration" },
      { key: "longevity", label: "Longevity" },
    ],
  },
  entries: [
    {
      id: "extrait-de-parfum",
      name: "Extrait de Parfum / Parfum",
      alias: "Pure Perfume",
      facts: {
        oil: { value: "20%–30%" },
        // TODO(owner): the supplied longevity reads "Average 10" with no
        // unit. Do not assume hours. Replace null with the confirmed text
        // (in the style of "Average 6–10 hours") once the owner confirms it;
        // until then the page shows "To be confirmed".
        longevity: { value: null },
      },
      details:
        "The strongest, richest, and most expensive tier, often sold in smaller bottles or dabbers rather than sprays.",
    },
    {
      id: "eau-de-parfum",
      name: "Eau de Parfum",
      abbreviation: "EDP",
      facts: {
        oil: { value: "15%–20%", note: "Sometimes 10%–20%" },
        longevity: { value: "Average 6–10 hours" },
      },
      details:
        "One of the most common formats for fine fragrances, balancing strong projection with all-day wear.",
    },
    {
      id: "eau-de-toilette",
      name: "Eau de Toilette",
      abbreviation: "EDT",
      facts: {
        oil: { value: "5%–15%" },
        longevity: { value: "Average 2–6 hours" },
      },
      details:
        "A lighter, fresher daily option that is widely popular and more affordable.",
    },
  ],
  sections: [
    {
      id: "why-longevity-varies",
      title: "Why perfume longevity varies",
      paragraphs: [
        [
          "Longevity may vary depending on how many sprays, weather, surfaces or any other conditions.",
        ],
      ],
    },
  ],
  explore: {
    id: "explore-the-collection",
    title: "Explore the collection",
    links: [
      { text: "All perfumes", href: paths.products },
      { text: "Men’s perfumes", href: paths.menPerfumes },
      { text: "Women’s perfumes", href: paths.womenPerfumes },
    ],
    help: {
      text: "Need help choosing a fragrance?",
      link: { text: "Contact our team", href: paths.contact },
    },
  },
  chrome: {
    meta: "3 Concentration Levels",
    unconfirmed: "To be confirmed",
  },
}
