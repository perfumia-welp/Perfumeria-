import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { useI18n } from "@/i18n/i18nContext"
import { formatSize } from "@/lib/formatSize"
import { productPath } from "@/router/paths"
import type { Product } from "@/types/catalog"
import AppLink from "../ui/AppLink"
import Icon from "../ui/Icon"
import ProductPrice from "./ProductPrice"
import WishlistButton from "./WishlistButton"
import "./ProductCardScent.css"

/*
 * B · SCENT POSTER — experimental catalogue card (see cardDesign.ts).
 * A separate component with its own stylesheet: the approved card
 * (ProductCard) is not touched. Same data, links, wishlist and bag
 * behaviour; only the presentation differs.
 *
 * Each card is a small campaign poster: a ghosted editorial word behind the
 * bottle, a faint studio atmosphere for the fragrance, and one calm purchase
 * row (price at the start, action at the far end).
 */

interface ProductCardScentProps {
  product: Product
  /** Editorial index shown on the stage ("05"). */
  position: number
  /** Number of fragrances in the list, shown after the index ("05 / 08"). */
  total?: number
  onAddToBag: (product: Product) => void
  /** Heading level for the product name, to fit the page outline. */
  headingLevel?: "h2" | "h3"
}

/** How long "Added" replaces "Add to Bag" after a click. */
const ADDED_FEEDBACK_MS = 2000

/** The longest lead note set as the ghost word; longer ones use the family. */
const GHOST_MAX_LETTERS = 7

const NBSP = String.fromCharCode(0xa0)

const pad = (value: number) => String(value).padStart(2, "0")

/**
 * "Iris · White Musk · 50 ml", breaking only between items: a two-word note
 * or a size never splits across lines, and a line never starts with the dot.
 */
const dotted = (items: (string | undefined)[]) =>
  items
    .flatMap((item) => (item ? [item.replace(/ /g, NBSP)] : []))
    .join(`${NBSP}· `)

export default function ProductCardScent({
  product,
  position,
  total,
  onAddToBag,
  headingLevel: Heading = "h3",
}: ProductCardScentProps) {
  const { t } = useI18n()
  const [added, setAdded] = useState(false)
  const addedTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(addedTimer.current), [])

  const href = productPath(product.slug)
  const details = dotted([
    ...product.notes,
    product.size && formatSize(product.size, t.common.millilitres),
  ])

  /*
   * Ghost word: the lead note when it is one short word (IRIS, OUD, CEDAR),
   * otherwise the fragrance family (WOODY for "Sandalwood"), otherwise the
   * product name itself, set as a wrapped ghost line (company products have
   * no scent metadata yet). Nothing is invented.
   */
  const family = (product.family ? t.catalog.families[product.family] : product.fragranceFamily ?? "")
  const lead = product.notes[0]
  const leadWord =
    lead && !lead.includes(" ") && lead.length <= GHOST_MAX_LETTERS
      ? lead
      : ""
  const ghostIsName = !leadWord && !family
  const ghost = leadWord || family || product.name

  /*
   * The word's own width in em, measured once its typeface has loaded, so
   * the stylesheet can size every word to the same overhang whatever its
   * letters (Latin capitals or joined Arabic). Until then the stylesheet
   * estimates from the letter count.
   */
  const ghostRef = useRef<HTMLSpanElement>(null)
  const [ghostEm, setGhostEm] = useState<number>()
  useLayoutEffect(() => {
    const element = ghostRef.current
    if (!element) return
    let current = true
    const measure = () => {
      const fontSize = parseFloat(getComputedStyle(element).fontSize)
      if (current && fontSize) setGhostEm(element.offsetWidth / fontSize)
    }
    measure()
    void document.fonts.ready.then(measure)
    return () => {
      current = false
    }
  }, [ghost])

  /*
   * Studio atmosphere: the family, except that oud fragrances get their own
   * deeper neutral. Oud is a key note rather than a catalogue family, so it
   * is recognised by that note (in the visitor's language).
   */
  const oud = t.catalog.notes.Oud ?? "Oud"
  const mood = product.notes.includes(oud) ? "oud" : product.family

  /* Scent story for desktop hover: character, then heart and base accords. */
  const story = product.story
  const scent =
    story &&
    dotted(
      [
        story.character[0],
        story.composition.heart[0],
        story.composition.base[0],
      ]
        .filter(Boolean)
        .map((word, index) => (index ? word.toLocaleLowerCase() : word)),
    )

  const add = () => {
    onAddToBag(product)
    setAdded(true)
    window.clearTimeout(addedTimer.current)
    addedTimer.current = window.setTimeout(
      () => setAdded(false),
      ADDED_FEEDBACK_MS,
    )
  }

  const image = (className?: string) => (
    <img
      className={className}
      src={product.packshot.src}
      srcSet={product.packshot.srcSet}
      alt=""
      loading="lazy"
      decoding="async"
    />
  )

  return (
    <article
      className={`scent-card${product.packshotStyle === "photo" ? " scent-card--photo" : ""}`}
      data-mood={mood}
    >
      <div className="scent-card__stage">
        <span className="scent-card__atmosphere" aria-hidden="true" />
        {/* Decorative: the notes and family are in the text below the stage. */}
        <span
          ref={ghostRef}
          className={`scent-card__ghost${ghostIsName ? " scent-card__ghost--name" : ""}`}
          {...(ghostIsName && product.contentLocale?.name === "en"
            ? { lang: "en", dir: "ltr" }
            : {})}
          aria-hidden="true"
          style={
            {
              "--ghost-letters": ghost.length,
              "--ghost-em": ghostEm,
            } as CSSProperties
          }
        >
          {ghost}
        </span>
        <span className="scent-card__floor" aria-hidden="true" />
        <span className="scent-card__index" aria-hidden="true">
          {pad(position)}
          {total !== undefined && ` / ${pad(total)}`}
        </span>
        {/*
         * The image repeats the name link for pointer users only; keyboard and
         * screen-reader users reach the product page once, through the name.
         */}
        <AppLink
          className="scent-card__image-link"
          href={href}
          tabIndex={-1}
          aria-hidden="true"
        >
          {image("scent-card__reflection")}
          {image("scent-card__bottle")}
        </AppLink>
        {/* Extra colour on desktop hover; the key notes are always shown below. */}
        {scent && (
          <p className="scent-card__scent" aria-hidden="true">
            {scent}
          </p>
        )}
        <WishlistButton product={product} className="scent-card__wishlist" />
      </div>

      <div className="scent-card__body">
        <div className="scent-card__info">
          <Heading className="scent-card__name">
            <AppLink className="scent-card__link" href={href}>
              {product.name}
            </AppLink>
          </Heading>
          {details && <p className="scent-card__notes">{details}</p>}
        </div>

        <div className="scent-card__purchase">
          <ProductPrice product={product} className="scent-card__price" />
          {product.inStock ? (
            <button
              type="button"
              className={`scent-card__add${added ? " is-added" : ""}`}
              aria-label={t.product.addToBagLabel(product.name)}
              onClick={add}
            >
              <span className="scent-card__add-label">
                {added ? t.product.added : t.product.addToBag}
              </span>
              {added ? (
                <svg
                  className="icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              ) : (
                <Icon name="arrow" />
              )}
            </button>
          ) : (
            <span className="scent-card__unavailable">
              {t.product.outOfStock}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
