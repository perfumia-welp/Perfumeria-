import { company } from "@/config/company"
import { paths } from "@/router/paths"
import type {
  AboutCompanyContent,
  CaptionedImage,
  ImageAsset,
} from "@/types/content"
import { unsplashImage } from "./mockImages"

/*
 * The English About page: owner-approved company copy (supplied 2026-10-17).
 * Keep the wording as supplied; only the brand name is interpolated, from
 * company.name ("Perfumira", the owner-confirmed spelling).
 *
 * "More than 450" is the owner's portfolio figure, not the catalogue count.
 *
 * Arabic: no approved Arabic version exists yet, so /ar/about keeps its
 * earlier copy (i18n/ar/about.ts via data/about.ts). Do not machine-translate.
 *
 * Photography is temporary Unsplash imagery and client stock video, the same
 * assets the page used before.
 */

const brand = company.name

const heroImage = unsplashImage("1608721279136-cd41b752fa41", "", {
  width: 1400,
  quality: 88,
  widths: [700, 1000, 1400, 2000],
})

const qualityImage = unsplashImage("1588405748880-12d1d2a59f75", "", {
  width: 1200,
  quality: 88,
  widths: [600, 900, 1200, 1600],
})

const distributionImage: ImageAsset = {
  src: `${import.meta.env.BASE_URL}images/about/about-why-poster.webp`,
  alt: "",
}

const visual = (
  image: ImageAsset,
  alt: string,
  caption: string,
  position: string,
): CaptionedImage => ({ image: { ...image, alt }, caption, position })

export const aboutCompany: AboutCompanyContent = {
  hero: {
    eyebrow: "Our Story",
    title: "A Passion for Perfumes Since 1997",
    lead: `At ${brand}, perfume is more than a business — it is our passion and our expertise.`,
    signature: ["Egypt", "Since 1997"],
    visual: visual(
      heroImage,
      "Perfume bottle illuminated by soft, rose-toned light",
      `About ${brand}`,
      "center 51%",
    ),
  },
  heritage: {
    eyebrow: "01 / Our Heritage",
    year: "1997",
    yearLabel: "The beginning",
    yearCaption: "Perfume distribution",
    title: "Built on Years of Experience",
    paragraphs: [
      "Our journey began in 1997, when we started distributing perfumes throughout Egypt. Built on years of experience, a commitment to quality, and a deep understanding of the fragrance market, we gradually expanded our operations to become one of the major perfume importers and distributors in Egypt.",
      "Today, we continue to build on that legacy by bringing an extensive world of fragrances to retailers, business partners, and perfume lovers.",
    ],
    // Each stop restates the first paragraph; no new dates or figures.
    milestones: [
      { label: "Reach", text: "Throughout Egypt" },
      { label: "Today", text: "A major perfume importer and distributor" },
    ],
  },
  collection: {
    eyebrow: "02 / The Collection",
    figure: "450+",
    figureLabel: "Perfume varieties",
    title: "More Than 450 Fragrances to Explore",
    paragraphs: [
      "We believe everyone deserves to find a fragrance that matches their personality, style, and preferences.",
      `That is why ${brand} offers a selection of more than 450 perfume varieties, covering a wide range of fragrance styles, preferences, and budgets.`,
      "From elegant European fragrances to rich Eastern scents, our collection includes a diverse choice of perfumes for different tastes and occasions.",
    ],
    // One owner sentence set as a list (lead-in, the four styles, close);
    // only capitals and list punctuation differ from the supplied text.
    styles: {
      lead: "Whether you love",
      items: [
        "Fresh and modern aromas",
        "Sophisticated floral notes",
        "Warm woody fragrances",
        "Distinctive oriental scents",
      ],
      close: `There is a world of fragrances to discover at ${brand}.`,
    },
    // Proof points: each restates an owner sentence above; nothing is
    // computed or added (no years-of-experience, city or customer counts).
    proofs: [
      // "Our journey began in 1997, when we started distributing perfumes…"
      { value: "1997", label: "Since 1997" },
      // "…a selection of more than 450 perfume varieties…"
      { value: "450+", label: "Perfume varieties" },
      // "…to become one of the major perfume importers and distributors in Egypt."
      {
        value: "Major Importer",
        label: "Perfume importer and distributor in Egypt",
      },
      // "From elegant European fragrances to rich Eastern scents…"
      { value: "European + Eastern", label: "Fragrance selection" },
    ],
    controls: {
      pause: "Pause the fragrance styles",
      play: "Play the fragrance styles",
    },
  },
  quality: {
    eyebrow: "03 / Quality",
    title: "Quality Is at the Heart of Everything We Do",
    statement: "Quality has always been one of our core values.",
    paragraphs: [
      "We understand that choosing a perfume is a personal experience, and we believe that our customers deserve products selected with care and attention to quality.",
      "Our focus on quality guides the way we approach our product selection, supplier relationships, and long-term business partnerships. We continuously strive to offer a fragrance collection that meets our standards and the expectations of the customers and businesses we serve.",
    ],
    visual: visual(
      qualityImage,
      "Golden perfume bottle resting on softly folded silk",
      "A commitment to quality",
      "center 56%",
    ),
  },
  distribution: {
    eyebrow: "04 / Import & Distribution",
    title: "From Distribution to a Leading Import and Distribution Business",
    paragraphs: [
      "What started in 1997 as a perfume distribution business has grown over the years through experience, dedication, and lasting relationships across Egypt’s perfume market.",
      "Our growth has allowed us to expand our range and strengthen our role in perfume importing and distribution, serving the needs of businesses looking for variety, quality, and a dependable supply partner.",
    ],
    // One owner sentence set as a list; only capitals and punctuation differ.
    pillars: {
      lead: "With decades of industry experience, we understand the importance of",
      items: [
        "Product availability",
        "A diverse selection",
        "Long-term relationships built on trust",
      ],
    },
    visual: {
      ...visual(
        distributionImage,
        "Woman resting beside an amber perfume bottle against a deep red backdrop",
        "Decades of experience",
        "center 38%",
      ),
      video: {
        src: `${import.meta.env.BASE_URL}videos/about-why-perfumeria.mp4`,
        type: "video/mp4",
      },
    },
  },
  audiences: {
    eyebrow: "05 / Who We Serve",
    title: "Serving Retailers, Businesses, and Perfume Lovers",
    intro: `${brand} brings together a broad fragrance selection and extensive market experience to serve different customer needs.`,
    // One owner sentence split across the two audiences; only capitals and
    // punctuation differ from the supplied text.
    lead: "Whether you are",
    groups: [
      {
        label: "Perfume lovers",
        text: "Exploring perfumes for personal use",
      },
      {
        label: "Retailers & businesses",
        text: "Looking for a supplier for your perfume shop or retail business",
      },
    ],
    close: "Our goal is to make discovering and sourcing fragrances easier.",
    commitment:
      "We are committed to building lasting relationships with our customers and partners through quality, variety, and a genuine passion for perfumes.",
  },
  invitation: {
    title: `Discover the World of ${brand}`,
    highlights: [
      "More than 450 fragrances.",
      "Decades of experience.",
      "A commitment to quality.",
    ],
    text: "Since 1997, our journey has been driven by one enduring goal: bringing a diverse world of perfumes to Egypt.",
    closing: `Discover your next fragrance with ${brand}.`,
    primary: { label: "Explore Our Perfumes", href: paths.products },
    secondary: { label: "Wholesale Inquiries", href: paths.contact },
  },
}
