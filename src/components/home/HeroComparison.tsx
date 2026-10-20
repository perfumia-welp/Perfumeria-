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
 * DESIGN REVIEW ONLY (hero comparison): the split hero (A), the campaign
 * alternative (B) and the 3D perfume stage (C, shown first) with a switch.
 * HomePage loads this only on the dev server and the Cloudflare review
 * preview (config/designPreview.ts); the production build never includes it,
 * so customers there see the production hero.
 *
 * The choice is remembered in this browser, so it survives reloads and
 * navigation. /?compare-hero=a, =b or =c opens a specific hero directly.
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
