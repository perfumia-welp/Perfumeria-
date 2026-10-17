import type {
  BilingualText,
  FragranceFamily,
  Gender,
  Product,
  ProductVariation,
  SelectedOption,
} from "../../types/catalog.ts"
import { parseSizeMl } from "./size.ts"

/*
 * The only place that knows Welp field names. Everything leaves as the
 * normalized Product the UI already uses.
 *
 * Language: the company has no real Arabic catalogue (its *_ar fields are
 * mostly English, and the WEBSITE response has one `name` / `description`).
 * Company text is therefore treated as English. On Arabic pages:
 *   1. our own Arabic from Supabase (product_metadata) when present
 *   2. otherwise the company English, marked with contentLocale "en"
 * Nothing is translated automatically and no Arabic is invented.
 */

/** One product as the WEBSITE list, all-products and detail endpoints return it. */
export interface WelpProduct {
  id: number
  product_type: number | null
  name: string
  description?: string | null
  price_before_discount?: number | string | null
  price_after_discount: number | string
  image: string
  is_available: boolean
  is_variation_available?: boolean
  is_offer?: boolean
  offer_valid_from?: string | null
  offer_valid_to?: string | null
  /** Detail endpoint only. */
  variations?: WelpVariation[]
}

export interface WelpVariation {
  id: number
  name: string
  is_required: boolean
  is_select_multiple?: boolean
  min_selection?: number
  max_selection?: number
  is_main_price: boolean
  options: {
    id: number
    name: string
    additional_price?: number | string | null
    price_before_discount?: number | string | null
    price_after_discount?: number | string | null
  }[]
}

/** Our supplemental row (public.product_metadata). Columns after `editorial_*` are proposed only. */
export interface ProductMetadata {
  business_id: number
  product_id: number
  brand?: string | null
  gender?: Gender | null
  fragrance_family?: string | null
  top_notes?: string[] | null
  heart_notes?: string[] | null
  base_notes?: string[] | null
  ingredients?: string | null
  editorial_description_en?: string | null
  /** Our Arabic product description; the company has none. */
  editorial_description_ar?: string | null
  /** Proposed (20261017090000): our Arabic product name. */
  name_ar?: string | null
  /** Proposed (20261017090000): curated size when the company text has none. */
  size_ml?: number | null
}

export interface GalleryRow {
  id: string
  business_id: number
  product_id: number
  image_url: string
  sort_order: number
  alt_en?: string | null
  alt_ar?: string | null
}

export interface AdapterConfig {
  businessId: number
  currency: string
  mediaOrigin?: string
  /** Company product type → gender (1344 men, 1382 women). */
  productTypeGender?: Record<number, Gender>
  /** Company product type → its English name, from all-products groups. */
  categoryNames?: Record<number, string>
}

type Locale = "en" | "ar"

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

export function localizedText(value: BilingualText, locale: Locale): string {
  for (const part of [value.en, value.ar]) {
    if (part != null && typeof part !== "string")
      throw new Error("Invalid bilingual content")
  }
  return (
    value[locale]?.trim() || value[locale === "en" ? "ar" : "en"]?.trim() || ""
  )
}

export function normalizeImageUrl(value: string, mediaOrigin?: string): string {
  const path = typeof value === "string" ? value.trim() : ""
  if (!path) throw new Error("Missing product image")
  if (/^https?:\/\//i.test(path)) {
    const url = new URL(path)
    if (url.username || url.password)
      throw new Error("Invalid image credentials")
    return url.href
  }
  if (
    /^[a-z][a-z\d+.-]*:/i.test(path) ||
    path.startsWith("//") ||
    path.includes("\\")
  ) {
    throw new Error("Unsupported image URL")
  }
  if (!mediaOrigin) throw new Error("Media origin is not configured")
  const origin = new URL(mediaOrigin)
  if (!/^https?:$/.test(origin.protocol) || origin.username || origin.password)
    throw new Error("Invalid media origin")
  return new URL(path, origin.origin + "/").href
}

function money(value: unknown): number {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value.trim()))
  )
    throw new Error("Invalid product price")
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error("Invalid product price")
  return amount
}

/**
 * price = price_after_discount (what the customer pays).
 * compareAtPrice = price_before_discount only when it is a valid, higher
 * price; a missing, equal, lower or malformed "before" never invents a sale.
 */
export function normalizePrices(before: unknown, after: unknown) {
  const price = money(after)
  if (before == null || before === "") return { price }
  let original: number
  try {
    original = money(before)
  } catch {
    return { price }
  }
  return original > price ? { price, compareAtPrice: original } : { price }
}

const positiveId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0

/*
 * Option labels arrive in Arabic only ("بالعلبة" / "بدون علبة", heading
 * "اختر"), spelled several ways. Arabic pages show the company's exact label;
 * English pages get the English of these known labels. Any other label is
 * shown as the company wrote it in both languages.
 */
const fold = (value: string) =>
  value.trim().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ")
const KNOWN_ENGLISH: Record<string, string> = {
  [fold("بالعلبة")]: "With box",
  [fold("بدون علبة")]: "Without box",
  [fold("اختر")]: "Choose",
  [fold("اختار")]: "Choose",
}
export function optionLabel(raw: string): BilingualText {
  const label = text(raw)
  if (!label) throw new Error("Missing option label")
  return { en: KNOWN_ENGLISH[fold(label)] ?? label, ar: label }
}

export function normalizeVariations(value: unknown): ProductVariation[] {
  if (value == null) return []
  if (!Array.isArray(value)) throw new Error("Invalid variations")
  return value.map((raw: WelpVariation) => {
    if (
      !positiveId(raw?.id) ||
      typeof raw.is_required !== "boolean" ||
      typeof raw.is_main_price !== "boolean" ||
      !Array.isArray(raw.options) ||
      raw.options.length === 0
    )
      throw new Error("Invalid variation")
    // A multi-select choice has no defined price semantics here: fail closed.
    if (raw.is_select_multiple || (raw.max_selection ?? 1) !== 1)
      throw new Error("Unsupported multi-select variation")
    return {
      id: String(raw.id),
      name: optionLabel(raw.name),
      required: raw.is_required,
      replacesPrice: raw.is_main_price,
      options: raw.options.map((option) => {
        if (!positiveId(option?.id)) throw new Error("Invalid option")
        const base = { id: String(option.id), name: optionLabel(option.name) }
        if (raw.is_main_price)
          return {
            ...base,
            ...normalizePrices(
              option.price_before_discount,
              option.price_after_discount,
            ),
          }
        return option.additional_price == null
          ? base
          : { ...base, additionalPrice: money(option.additional_price) }
      }),
    }
  })
}

export function normalizeProduct(
  row: WelpProduct,
  config: AdapterConfig,
  locale: Locale,
  metadata?: ProductMetadata,
  gallery: GalleryRow[] = [],
): Product {
  if (!positiveId(row?.id) || !positiveId(config.businessId))
    throw new Error("Invalid product identity")
  if (typeof row.is_available !== "boolean")
    throw new Error("Invalid availability")
  if (!/^[A-Z]{3}$/.test(config.currency))
    throw new Error("Currency is not configured")
  if (row.product_type != null && !positiveId(row.product_type))
    throw new Error("Invalid category identity")
  for (const value of [row.name, row.description])
    if (value != null && typeof value !== "string")
      throw new Error("Invalid product text")

  const companyName = text(row.name)
  if (!companyName) throw new Error("Missing product name")
  const companyDescription = text(row.description)

  const meta =
    metadata?.business_id === config.businessId &&
    metadata.product_id === row.id
      ? metadata
      : undefined

  // Explicit fallback: our Arabic, else the company's English.
  const nameAr = text(meta?.name_ar)
  const descriptionAr = text(meta?.editorial_description_ar)
  const useArName = locale === "ar" && !!nameAr
  const useArDescription = locale === "ar" && !!descriptionAr
  const name = useArName ? nameAr : companyName
  const description = useArDescription ? descriptionAr : companyDescription

  const composition = {
    top: meta?.top_notes ?? [],
    heart: meta?.heart_notes ?? [],
    base: meta?.base_notes ?? [],
  }
  const family = text(meta?.fragrance_family) || undefined
  const type = row.product_type ?? undefined
  const categoryName = type ? config.categoryNames?.[type] : undefined

  const curatedSize = positiveId(meta?.size_ml)
    ? (meta?.size_ml as number)
    : undefined
  const parsedSize = curatedSize
    ? undefined
    : parseSizeMl(companyName, companyDescription)
  const size = curatedSize ?? parsedSize

  const variations = normalizeVariations(row.variations)

  return {
    id: String(row.id),
    productId: row.id,
    businessId: config.businessId,
    slug: `product-${row.id}`,
    name,
    translations: {
      name: { en: companyName, ar: nameAr || null },
      description: { en: companyDescription, ar: descriptionAr || null },
    },
    contentLocale: {
      name: useArName ? "ar" : "en",
      description: useArDescription ? "ar" : "en",
    },
    description,
    ...normalizePrices(row.price_before_discount, row.price_after_discount),
    currency: config.currency,
    inStock: row.is_available,
    packshot: {
      src: normalizeImageUrl(row.image, config.mediaOrigin),
      alt: name,
    },
    // Company images are branded photographs, not transparent cut-outs.
    packshotStyle: "photo",
    category: type
      ? {
          id: type,
          name: categoryName ?? "",
          translations: { en: categoryName ?? null, ar: null },
        }
      : undefined,
    gender:
      meta?.gender ?? (type ? config.productTypeGender?.[type] : undefined),
    brand: text(meta?.brand) || undefined,
    fragranceFamily: family,
    family:
      family && ["floral", "woody", "amber"].includes(family)
        ? (family as FragranceFamily)
        : undefined,
    notes: [
      ...new Set([...composition.top, ...composition.heart, ...composition.base]),
    ],
    size: size ? `${size}ml` : undefined,
    sizeSource: curatedSize ? "metadata" : parsedSize ? "parsed" : undefined,
    story:
      description || Object.values(composition).some((notes) => notes.length)
        ? { description, composition, character: [] }
        : undefined,
    ingredients: text(meta?.ingredients) || undefined,
    editorialDescription: meta
      ? { en: meta.editorial_description_en, ar: meta.editorial_description_ar }
      : undefined,
    gallery: gallery
      .filter(
        (image) =>
          image.business_id === config.businessId &&
          image.product_id === row.id,
      )
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
      .map((image) => ({
        src: normalizeImageUrl(image.image_url, config.mediaOrigin),
        alt: localizedText({ en: image.alt_en, ar: image.alt_ar }, locale) || name,
      })),
    variations,
    requiresOptionSelection:
      row.is_variation_available === true ||
      variations.some((variation) => variation.required),
  }
}

/** Separator between a product id and its picked option ids in a bag line id. */
export const OPTION_SEPARATOR = "~"

/**
 * The product as one bag line with its options picked. Main-price options
 * replace the price; other options add to it. Every required choice must be
 * picked with a real option, or this throws.
 */
export function applySelection(
  product: Product,
  picks: Record<string, string>,
  locale: Locale,
): Product {
  const variations = product.variations ?? []
  let price = product.price
  let compareAtPrice = product.compareAtPrice
  const selected: SelectedOption[] = []
  for (const variation of variations) {
    const optionId = picks[variation.id]
    if (optionId === undefined) {
      if (variation.required) throw new Error("Option required")
      continue
    }
    const option = variation.options.find((item) => item.id === optionId)
    if (!option) throw new Error("Unknown option")
    if (variation.replacesPrice) {
      if (option.price === undefined) throw new Error("Option has no price")
      price = option.price
      compareAtPrice = option.compareAtPrice
    } else if (option.additionalPrice) {
      price += option.additionalPrice
      if (compareAtPrice !== undefined) compareAtPrice += option.additionalPrice
    }
    selected.push({
      variationId: Number(variation.id),
      optionId: Number(option.id),
      label: option.name,
    })
  }
  if (Object.keys(picks).some((id) => !variations.some((v) => v.id === id)))
    throw new Error("Unknown choice")
  // Nothing required and nothing picked: the product as listed, ready for the bag.
  if (!selected.length) return { ...product, requiresOptionSelection: false }
  const labels = selected.map((item) => localizedText(item.label, locale))
  return {
    ...product,
    id: [product.id, ...selected.map((item) => item.optionId)].join(
      OPTION_SEPARATOR,
    ),
    name: `${product.name} (${labels.join(", ")})`,
    price,
    compareAtPrice,
    selectedOptions: selected,
    requiresOptionSelection: false,
  }
}

/**
 * Lowest and highest price a customer can pay through the required
 * main-price choices (with box / without box). Undefined when the product's
 * price does not depend on such a choice, or its options are not loaded.
 */
export function optionPriceRange(product: Product) {
  let min = Infinity
  let max = -Infinity
  for (const variation of product.variations ?? []) {
    if (!variation.replacesPrice || !variation.required) continue
    for (const option of variation.options) {
      if (option.price === undefined) continue
      min = Math.min(min, option.price)
      max = Math.max(max, option.price)
    }
  }
  return Number.isFinite(min) ? { min, max } : undefined
}
