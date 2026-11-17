import { CARD_DESIGNS, type CardDesign } from "../product/cardDesign"
import "./CardDesignToggle.css"

/*
 * DESIGN REVIEW ONLY (product card comparison): design-review switch between
 * the packshot card (A), the Scent Poster experiment (B) and the approved
 * Scent Dossier card (C, the production catalogue card).
 * ProductsPage loads this only on the dev server and the Cloudflare review
 * preview (config/designPreview.ts); perfumira.net never shows it. Not a
 * product feature.
 */

// Fetch the experimental card up front so the first switch is instant.
void import("../product/ProductCardScent")

export default function CardDesignToggle({
  value,
  onChange,
}: {
  value: CardDesign
  onChange: (value: CardDesign) => void
}) {
  return (
    <div
      className="card-design-toggle"
      role="group"
      aria-label="Product card design comparison (development only)"
    >
      {CARD_DESIGNS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          disabled={!option.available}
          title={option.available ? undefined : "Coming next"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {!option.available && <small>Coming next</small>}
        </button>
      ))}
    </div>
  )
}
