import { startTransition, useState } from "react"

/*
 * Catalogue card designs — three slots.
 *
 * "current"  — A, the approved card (ProductCard, packshot variant).
 * "scent"    — B, the Scent Poster experiment (ProductCardScent).
 * "dossier"  — C, the Scent Dossier experiment (ProductCardDossier).
 *
 * Customers always get PRODUCTION_CARD_DESIGN. On the Vite dev server the
 * Products page shows a switch between the slots (CardDesignToggle); the
 * choice is remembered in this browser, and /products?compare-card=a or =b
 * opens a specific design directly.
 */

export type CardDesign = "current" | "scent" | "dossier"

/** The design customers see. Change only once a design is approved. */
export const PRODUCTION_CARD_DESIGN: CardDesign = "current"

interface CardDesignOption {
  value: CardDesign
  letter: string
  label: string
  /** False while a slot has no design: shown in the switch, never selected. */
  available: boolean
}

export const CARD_DESIGNS: CardDesignOption[] = [
  { value: "current", letter: "a", label: "A · Current", available: true },
  { value: "scent", letter: "b", label: "B · Scent Poster", available: true },
  { value: "dossier", letter: "c", label: "C · Scent Dossier", available: true },
]

const STORAGE_KEY = "perfumeria:dev-card"

const asDesign = (value: string | null | undefined) =>
  CARD_DESIGNS.find(
    (option) =>
      option.available && (option.value === value || option.letter === value),
  )?.value

function initialDesign(): CardDesign {
  if (!import.meta.env.DEV) return PRODUCTION_CARD_DESIGN
  const requested = new URLSearchParams(window.location.search)
    .get("compare-card")
    ?.toLowerCase()
  let stored: string | null = null
  try {
    stored = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage unavailable: fall back to the approved card.
  }
  return asDesign(requested) ?? asDesign(stored) ?? PRODUCTION_CARD_DESIGN
}

/** The card design for the catalogue, and (dev server only) a way to change it. */
export function useCardDesign() {
  const [design, setDesign] = useState<CardDesign>(initialDesign)

  const choose = (next: CardDesign) => {
    if (!asDesign(next)) return
    // A transition keeps the current cards on screen while the other loads.
    startTransition(() => setDesign(next))
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable: the choice lasts until the next reload.
    }
  }

  return [design, choose] as const
}
