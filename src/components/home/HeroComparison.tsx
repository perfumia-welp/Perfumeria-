import { useState } from "react"
import type { HeroContent } from "@/types/content"
import Hero from "./Hero"
import HeroCampaign from "./HeroCampaign"
import HeroPerfume, { preloadFirstBottle } from "./HeroPerfume"
import HeroVariantToggle, {
  HERO_VARIANTS,
  type HeroVariant,
} from "./HeroVariantToggle"

/*
 * DEVELOPER ONLY (hero comparison): the split hero (A), the campaign hero
 * (B, the production hero since 2026-10-22) and the 3D perfume stage (C)
 * with a switch. HomePage loads this only on the Vite dev server when the
 * address has ?compare-hero; no build includes it, so visitors on the
 * Cloudflare preview and perfumira.net only ever see Hero B.
 *
 * Inside the comparison the choice is remembered in this browser.
 * /?compare-hero=a, =b or =c opens a specific hero directly.
 */

const STORAGE_KEY = "perfumeria:dev-hero"

/** Shown first on the review preview: C, the 3D Perfume hero. */
const DEFAULT_VARIANT: HeroVariant = "perfume"

const BY_LETTER: Record<string, HeroVariant> = {
  a: "split",
  b: "campaign",
  c: "perfume",
}

const asVariant = (value: string | null | undefined) =>
  HERO_VARIANTS.find((variant) => variant === value)

function initialVariant(): HeroVariant {
  const requested = new URLSearchParams(window.location.search)
    .get("compare-hero")
    ?.toLowerCase()
  let stored: string | null = null
  try {
    stored = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage unavailable: fall back to the default hero.
  }
  return (
    BY_LETTER[requested ?? ""] ??
    asVariant(requested) ??
    asVariant(stored) ??
    DEFAULT_VARIANT
  )
}

// This chunk downloads with the app on the homepage (HomePage.tsx); when it
// will show Hero C, its first bottle starts loading now too.
if (initialVariant() === "perfume") preloadFirstBottle()

export default function HeroComparison({ content }: { content: HeroContent }) {
  const [variant, setVariant] = useState<HeroVariant>(initialVariant)

  const choose = (next: HeroVariant) => {
    setVariant(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable: the choice lasts until the next reload.
    }
  }

  return (
    <div className="hero-compare">
      {variant === "split" && <Hero content={content} />}
      {variant === "campaign" && <HeroCampaign content={content} />}
      {variant === "perfume" && <HeroPerfume content={content} />}
      <HeroVariantToggle value={variant} onChange={choose} />
    </div>
  )
}
