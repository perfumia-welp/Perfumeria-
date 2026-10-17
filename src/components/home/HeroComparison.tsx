import { useState } from "react"
import type { HeroContent } from "@/types/content"
import Hero from "./Hero"
import HeroCampaign from "./HeroCampaign"
import HeroPerfume from "./HeroPerfume"
import HeroVariantToggle, {
  HERO_VARIANTS,
  type HeroVariant,
} from "./HeroVariantToggle"

/*
 * DEVELOPMENT ONLY (hero comparison): the approved split hero (A) with a
 * switch to the campaign alternative (B) and the 3D perfume stage (C).
 * HomePage loads this only on the Vite dev server; production builds never
 * include it, so customers always see the approved hero.
 *
 * The choice is remembered in this browser, so it survives reloads and
 * navigation. /?compare-hero=a, =b or =c opens a specific hero directly.
 */

const STORAGE_KEY = "perfumeria:dev-hero"

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
    // Storage unavailable: fall back to the approved hero.
  }
  return (
    BY_LETTER[requested ?? ""] ??
    asVariant(requested) ??
    asVariant(stored) ??
    "split"
  )
}

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
