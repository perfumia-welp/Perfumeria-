import "./HeroVariantToggle.css"

/*
 * TEMPORARY (hero comparison): design-review switch between the approved
 * split hero (A), the campaign alternative (B) and the 3D perfume stage (C).
 * Not a product feature; delete with the unused heroes once a direction is
 * chosen.
 */

export type HeroVariant = "split" | "campaign" | "perfume"

interface VariantOption {
  value: HeroVariant
  label: string
}

const OPTIONS: VariantOption[] = [
  { value: "split", label: "A · Split" },
  { value: "campaign", label: "B · Campaign" },
  { value: "perfume", label: "C · 3D Perfume" },
]

export const HERO_VARIANTS = OPTIONS.map((option) => option.value)

export default function HeroVariantToggle({
  value,
  onChange,
}: {
  value: HeroVariant
  onChange: (value: HeroVariant) => void
}) {
  return (
    <div
      className="hero-variant-toggle"
      role="group"
      aria-label="Hero design comparison (temporary)"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
