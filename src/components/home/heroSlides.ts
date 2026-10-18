import type { useI18n } from "@/i18n/i18nContext"
import { formatSize } from "@/lib/formatSize"
import { productPath } from "@/router/paths"
import { getHeroArt } from "@/services/catalog"
import type { Product } from "@/types/catalog"

/*
 * TEMPORARY (hero comparison): the one slide shape Hero C renders.
 *
 * Mock and live products both become a HeroSlide here, so HeroPerfume.tsx
 * has a single layout. Missing perfume data is replaced with other real
 * facts (gender, size, price, the product's own name), never invented, and
 * never by leaving a slot of the design empty.
 */

type Dictionary = ReturnType<typeof useI18n>["t"]

export type Tone = "blush" | "gold" | "night"

/** A sparkle on the bottle: x %, y % and size % of the bottle image box. */
export type Glint = [x: number, y: number, size: number]

export interface StageBottle {
  productId: string
  /** Backdrop, light and text colours for the slide (see HeroPerfume.css). */
  tone: Tone
  /** Width / height of the packshot, when the art does not carry its own. */
  aspect?: number
  /** Which of the product's character words is set large behind the bottle. */
  word: number
  glints: Glint[]
  /**
   * Art direction for one bottle (default: the mock treatment).
   * "contact": no shadow around the bottle, only a soft one under it, and a
   * fainter, softer reflection, for a dark bottle on the night backdrop.
   */
  finish?: "contact"
  /** Bottle size relative to the stage default, e.g. 0.93. */
  scale?: number
}

/** Text size step for long names and ghost words (see HeroPerfume.css). */
export type Length = "short" | "medium" | "long"

export interface HeroDetail {
  key: string
  label: string
  /** Text, or the product's live price ("price" row). */
  value: string | "price"
}

export interface HeroSlide extends StageBottle {
  product: Product
  art: string
  aspect: number
  eyebrow: string
  title: string
  titleLength: Length
  /** Language of the title and ghost word when it differs from the page. */
  textLang?: "en" | "ar"
  /** Language of the ghost word, when it is taken from the name. */
  ghostLang?: "en" | "ar"
  description: string
  descriptionLang?: "en" | "ar"
  keynotes: string
  ghost: string
  ghostLetters: number
  details: HeroDetail[]
  href: string
}

/* Words that name a concentration, a size or a gender rather than the scent. */
const QUALIFIERS =
  /\b(eau de (parfum|toilette|cologne)|extrait( de parfum)?|le parfum|parfum|edp|edt|edc|pour (homme|femme)|for (men|women)|homme|femme|men|women|\d+\s?ml)\b/gi

/**
 * The ghost word for a product without editorial words: the last word of its
 * real name once concentration, size and gender words are set aside
 * ("Yves Saint Laurent Mon Paris Eau de Parfum" gives "Paris").
 */
export function nameGhost(name: string) {
  const words = (text: string) => text.replace(/[^\p{L}\p{N}'’-]+/gu, " ").trim().split(/\s+/).filter(Boolean)
  const core = words(name.replace(QUALIFIERS, " "))
  return (core.length ? core : words(name)).at(-1) ?? ""
}

/* Company copy sometimes opens with a stray "_" or "*" list marker. */
const LEADING_MARKS = /^[\s_*•·#]+/

const lengthOf = (text: string, medium: number, long: number): Length =>
  text.length > long ? "long" : text.length > medium ? "medium" : "short"

export function toHeroSlide(
  bottle: StageBottle,
  product: Product,
  t: Dictionary,
  pageLocale: "en" | "ar",
): HeroSlide | undefined {
  const art = getHeroArt(product)
  if (!art) return undefined
  const aspect = "aspect" in art && typeof art.aspect === "number" ? art.aspect : (bottle.aspect ?? 1)

  const family = product.family ? t.catalog.families[product.family] : product.fragranceFamily ?? ""
  const gender = product.gender ? t.catalog.genders[product.gender] : ""
  const size = product.size ? formatSize(product.size, t.common.millilitres) : ""
  const composition = product.story?.composition
  const hasNotes = !!composition && Object.values(composition).some((notes) => notes.length)

  const editorial = product.story?.character[bottle.word] || family
  const ghost = editorial || nameGhost(product.name)
  const nameLang = product.contentLocale?.name
  const textLang = nameLang && nameLang !== pageLocale ? nameLang : undefined

  // The note pyramid when we have it; otherwise the real facts we do have.
  const details: HeroDetail[] = hasNotes
    ? (["top", "heart", "base"] as const)
        .filter((stage) => composition[stage].length)
        .map((stage) => ({
          key: stage,
          label: t.product.composition[stage],
          value: composition[stage].join(t.common.listSeparator),
        }))
    : [
        { key: "for", label: t.product.details.for, value: gender },
        { key: "size", label: t.product.details.size, value: size },
        { key: "price", label: t.product.dossier.price, value: "price" as const },
      ].filter((detail) => detail.value)

  return {
    ...bottle,
    product,
    art: art.src,
    aspect,
    eyebrow: family || gender || t.home.carousel.fragrance,
    title: product.name,
    titleLength: lengthOf(product.name, 16, 28),
    textLang,
    description: (product.story?.description || product.description || "").replace(LEADING_MARKS, ""),
    descriptionLang:
      product.contentLocale && product.contentLocale.description !== pageLocale
        ? product.contentLocale.description
        : undefined,
    keynotes: product.notes.length ? product.notes.join(" · ") : [gender, size].filter(Boolean).join(" · "),
    ghost,
    ghostLang: editorial ? undefined : textLang,
    ghostLetters: Math.max(ghost.length, 1),
    details,
    href: productPath(product.slug),
  }
}
