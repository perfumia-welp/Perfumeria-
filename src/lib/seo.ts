import { company } from "@/config/company"
import { SEO } from "@/config/site"
import type { Locale } from "@/i18n/locales"
import type { Gender, Product } from "@/types/catalog"
import { absoluteUrl } from "./documentMeta"

/*
 * Search rules shared by the page metadata (SiteLayout) and the pages that
 * add structured data. Structured data only ever states what the catalogue
 * or verified company settings hold: no brand, SKU, rating, review, address
 * or logo is filled in until real data exists.
 */

/** Vite's deploy base without the trailing slash ("" at the domain root). */
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

/** An app path ("/ar/products") with the deploy base, as canonical URLs use it. */
export const sitePath = (path: string) => `${basePath}${path}`

/** Query parameters that never change what a page is (dev tools, tracking). */
const IGNORED_PARAMS = ["catalog", "compare-card", "compare-hero"]

export interface ListingSeo {
  /** Query string kept in the canonical URL ("" or "?page=3"). */
  canonicalSearch: string
  /** Internal search results are not for search engines. */
  indexable: boolean
  /** /products filtered only by a collection's gender: that collection is canonical. */
  collection?: Gender
}

/**
 * Canonical policy for product listings. Pagination is indexable and
 * self-canonical (page 2 is not a copy of page 1); sort and filter views
 * point to the unfiltered listing; search results are noindex. A /products
 * view filtered to just men or women is the same list as that collection.
 */
export function listingSeo(search: string, collections: Gender[]): ListingSeo {
  const params = new URLSearchParams(search)
  IGNORED_PARAMS.forEach((name) => params.delete(name))
  const page = Number(params.get("page"))
  const pageSearch = Number.isInteger(page) && page > 1 ? `?page=${page}` : ""
  params.delete("page")
  const genders = params.getAll("gender")
  const onlyGender =
    genders.length === 1 &&
    [...params.keys()].every((key) => key === "gender") &&
    collections.includes(genders[0] as Gender)
  if (onlyGender)
    return {
      canonicalSearch: pageSearch,
      indexable: true,
      collection: genders[0] as Gender,
    }
  if ([...params.keys()].length)
    return { canonicalSearch: "", indexable: !params.has("q") }
  return { canonicalSearch: pageSearch, indexable: true }
}

/**
 * Whether a product has its own Arabic content. Live products show the
 * company's English name and description on Arabic pages until our Arabic
 * exists (Supabase product_metadata); such pages are not offered as Arabic
 * translations. Mock products are fully translated.
 */
export function hasArabicProductContent(product: Product) {
  const text = product.translations
  if (!text) return true
  return Boolean(
    text.name.ar?.trim() &&
      (!text.description.en?.trim() || text.description.ar?.trim()),
  )
}

/** Plain text for a meta description: no emoji, bullets or line breaks, cut at a word. */
export function metaExcerpt(text: string, max = 160) {
  const clean = text
    .replace(/\p{Extended_Pictographic}|️/gu, "")
    .replace(/(^|\s)[*•▪◦·-]+(?=\s)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : cut.length).replace(/[\s,;:.–-]+$/, "")}…`
}

const schemaAvailability = (inStock: boolean) =>
  `https://schema.org/${inStock ? "InStock" : "OutOfStock"}`

const ORGANIZATION_ID = () => absoluteUrl("/#organization")

/** Organization and WebSite, from verified settings only (config/company.ts, config/site.ts). */
export function siteSchema(homePath: string, locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID(),
        name: SEO.brand,
        url: absoluteUrl("/"),
        email: company.orderEmail,
        foundingDate: SEO.foundingYear,
        sameAs: Object.values(company.social),
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          telephone: company.whatsappNumber,
          email: company.orderEmail,
        },
      },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        url: absoluteUrl(homePath),
        name: SEO.brand,
        inLanguage: locale,
        publisher: { "@id": ORGANIZATION_ID() },
      },
    ],
  }
}

export interface Crumb {
  name: string
  /** App path including the deploy base. */
  path: string
}

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  }
}

export interface ProductSchemaInput {
  product: Product
  /** Canonical app path of the product page, including the deploy base. */
  path: string
  /** Size as shown on the page ("100 ml"), when known. */
  size?: string
  /** Required box / no-box choice with different prices. */
  priceRange?: { min: number; max: number }
  /** Description in the page language only (never a fallback language). */
  description?: string
}

/**
 * Product with one Offer, or an AggregateOffer (lowest to highest) when the
 * price depends on a required option such as with / without box, so no
 * single misleading price is stated.
 */
export function productSchema({
  product,
  path,
  size,
  priceRange,
  description,
}: ProductSchemaInput) {
  const url = absoluteUrl(path)
  const images = [
    product.packshot.src,
    ...(product.gallery ?? []).map((image) => image.src),
  ].map((src) => absoluteUrl(src))
  const optionCount =
    product.variations?.find((variation) => variation.replacesPrice)?.options
      .length ?? 0
  const offers =
    priceRange && priceRange.min !== priceRange.max
      ? {
          "@type": "AggregateOffer",
          lowPrice: priceRange.min,
          highPrice: priceRange.max,
          ...(optionCount > 1 ? { offerCount: optionCount } : {}),
          priceCurrency: product.currency,
          availability: schemaAvailability(product.inStock),
          url,
        }
      : {
          "@type": "Offer",
          price: priceRange?.min ?? product.price,
          priceCurrency: product.currency,
          availability: schemaAvailability(product.inStock),
          url,
        }
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    url,
    image: [...new Set(images)],
    ...(description ? { description: metaExcerpt(description, 5000) } : {}),
    ...(size ? { size } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    offers,
  }
}
