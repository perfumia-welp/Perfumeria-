import { useEffect, useId, useRef, useState } from "react"
import { useI18n } from "@/i18n/i18nContext"
import { formatSize } from "@/lib/formatSize"
import { productPath } from "@/router/paths"
import type { Product } from "@/types/catalog"
import AppLink from "../ui/AppLink"
import Icon from "../ui/Icon"
import ProductPrice from "./ProductPrice"
import WishlistButton from "./WishlistButton"
import "./ProductCardDossier.css"

interface Props {
  product: Product
  position: number
  onAddToBag: (product: Product) => void
  headingLevel?: "h2" | "h3"
}

const ADDED_FEEDBACK_MS = 2000
const pad = (value: number) => String(value).padStart(2, "0")

/*
 * A restrained editorial aura chosen from the physical packshot palette.
 * It is presentation-only and deliberately stays local to concept C.
 */
const auraByProduct: Record<string, "blush" | "champagne" | "mist" | "smoke"> = {
  "velvet-iris": "blush",
  "nocturne-rose": "blush",
  "fleur-de-peau": "blush",
  "santal-lumiere": "champagne",
  "amber-reverie": "champagne",
  "cedar-veil": "mist",
  "quiet-oud": "smoke",
  "eau-de-minuit": "smoke",
}

export default function ProductCardDossier({
  product,
  position,
  onAddToBag,
  headingLevel: Heading = "h3",
}: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const dossierId = useId()
  const href = productPath(product.slug)
  const story = product.story
  const family = (product.family ? t.catalog.families[product.family] : product.fragranceFamily ?? "")
  const aura = auraByProduct[product.slug] ?? (product.family === "floral" ? "blush" : product.family === "amber" ? "champagne" : "smoke")
  const classification = [family, product.notes[1]].filter(Boolean).join(" · ")
  const character = story?.character.slice(0, 2).join(" · ") || product.notes.join(" · ")
  const composition = story && Object.values(story.composition).some((notes) => notes.length) ? story.composition : undefined
  /*
   * The dossier sheet revealed over the stage: the scent notes when we have
   * them; otherwise only the real facts we do have (family, for, size,
   * price), never empty labels. The sheet itself is always there.
   */
  const facts = composition
    ? (["top", "heart", "base"] as const).map((key) => ({ key, label: t.product.composition[key], value: composition[key].join(", ") }))
    : [
        { key: "family", label: t.product.details.family, value: family },
        { key: "for", label: t.product.details.for, value: product.gender ? t.catalog.genders[product.gender] : "" },
        { key: "size", label: t.product.details.size, value: product.size ? formatSize(product.size, t.common.millilitres) : "" },
      ].filter((fact) => fact.value)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const add = () => {
    onAddToBag(product)
    setAdded(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS)
  }

  return (
    <article className={`dossier-card${open ? " is-open" : ""}${product.packshotStyle === "photo" ? " dossier-card--photo" : ""}`} data-aura={aura}>
      <div className="dossier-card__stage">
        <span className="dossier-card__aura" aria-hidden="true" />
        <span className="dossier-card__index" aria-hidden="true">{pad(position)}</span>
        <AppLink className="dossier-card__image-link" href={href} tabIndex={-1} aria-hidden="true">
          <img src={product.packshot.src} srcSet={product.packshot.srcSet} alt="" loading="lazy" decoding="async" />
        </AppLink>
        <WishlistButton product={product} className="dossier-card__wishlist" />
        {classification && <p className="dossier-card__classification">{classification}</p>}

        <div className="dossier-card__sheet" id={dossierId}>
            <dl>
              {facts.map((fact) => (
                <div key={fact.key}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
              {!composition && (
                <div>
                  <dt>{t.product.dossier.price}</dt>
                  <dd><ProductPrice product={product} className="dossier-card__sheet-price" /></dd>
                </div>
              )}
            </dl>
            <AppLink href={href} className="dossier-card__view">
              {t.product.dossier.viewFragrance} <Icon name="arrow" />
            </AppLink>
          </div>
      </div>

      <div className="dossier-card__body">
        <Heading className="dossier-card__name"><AppLink href={href}>{product.name}</AppLink></Heading>
        {(character || composition) && (
        <div className="dossier-card__descriptor-row">
          <p>{character}</p>
          {composition && (
            <button type="button" className="dossier-card__notes-toggle" aria-expanded={open} aria-controls={dossierId} onClick={() => setOpen((value) => !value)}>
              {open ? t.product.dossier.closeNotes : `${t.product.dossier.notes} +`}
            </button>
          )}
        </div>
        )}
        <div className="dossier-card__purchase">
          <ProductPrice product={product} className="dossier-card__price" />
          {product.inStock ? (
            <button type="button" className={`dossier-card__add${added ? " is-added" : ""}`} aria-label={t.product.addToBagLabel(product.name)} onClick={add}>
              {added ? t.product.added : t.product.addToBag} <Icon name="arrow" />
            </button>
          ) : <span className="dossier-card__unavailable">{t.product.outOfStock}</span>}
        </div>
      </div>
    </article>
  )
}
