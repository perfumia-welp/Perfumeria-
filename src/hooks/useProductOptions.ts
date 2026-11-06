import { useCallback, useState } from "react"
import type { DetailStatus } from "@/hooks/useLiveProduct"
import { useI18n } from "@/i18n/i18nContext"
import { selectProductOptions } from "@/services/catalog"
import type { Product, ProductVariation } from "@/types/catalog"

export interface ProductOptionsState {
  status: DetailStatus
  product: Product
  variations: ProductVariation[]
  picks: Record<string, string>
  pick: (variationId: string, optionId: string) => void
  /** The bag line for the current picks; undefined until every required choice is made. */
  selected?: Product
  /**
   * True after Add to Bag was pressed without every required pick. Only the
   * choices still missing show an error, and each clears once it is picked.
   */
  required: boolean
  /** Ids of the choices still needed before this can go in the bag. */
  missing: string[]
  /** Add to Bag without a full choice: flag the missing choices and go to the first. */
  showRequired: () => void
  /** Sent here by a card's Choose options: go to the first choice, without an error. */
  guideToChoice: () => void
  retry: () => void
}

/** DOM id of a choice's group on the product page (ProductOptions). */
export const optionGroupId = (variationId: string) => `pdp-option-${variationId}`

/**
 * Brings the first choice still missing into view and focuses it, so
 * keyboard and screen-reader users land on the group that needs them.
 */
function focusChoice(variationId: string | undefined) {
  const group = variationId
    ? document.getElementById(optionGroupId(variationId))
    : document.querySelector<HTMLElement>("fieldset:has(input[data-product-option])")
  const input = group?.querySelector<HTMLInputElement>("input[data-product-option]")
  if (!group || !input) return
  const box = group.getBoundingClientRect()
  // The sticky header covers the top of the viewport.
  const header = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0
  if (box.top < Math.max(header, 0) || box.bottom > window.innerHeight) {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    group.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" })
  }
  input.focus({ preventScroll: true })
}

/**
 * The company's choices for a product (with box / without box). They come
 * with the product detail, so a product that needs a pick waits for it.
 */
export function useProductOptions(
  product: Product,
  detailStatus: DetailStatus,
  retry: () => void,
): ProductOptionsState {
  const { locale } = useI18n()
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [required, setRequired] = useState(false)
  const status: DetailStatus = product.requiresOptionSelection ? detailStatus : "ready"

  let selected: Product | undefined
  if (status === "ready") {
    try {
      selected = selectProductOptions(product, picks, locale)
    } catch {
      selected = undefined
    }
  }
  const variations = status === "ready" ? (product.variations ?? []) : []
  const missing = variations
    .filter((variation) => variation.required && !picks[variation.id])
    .map((variation) => variation.id)
  // Picked but still not a complete line: the first group is the one to fix.
  if (!missing.length && !selected && variations[0]) missing.push(variations[0].id)
  const firstMissing = missing[0]

  const pick = useCallback((variationId: string, optionId: string) => {
    setPicks((current) => ({ ...current, [variationId]: optionId }))
  }, [])
  const showRequired = useCallback(() => {
    setRequired(true)
    focusChoice(firstMissing)
  }, [firstMissing])
  const guideToChoice = useCallback(() => focusChoice(firstMissing), [firstMissing])

  return {
    status,
    product,
    variations,
    picks,
    pick,
    selected,
    required,
    missing,
    showRequired,
    guideToChoice,
    retry,
  }
}
