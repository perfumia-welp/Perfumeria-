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
  /** True after Add to Bag was pressed without a required pick. */
  required: boolean
  showRequired: () => void
  retry: () => void
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

  const pick = useCallback((variationId: string, optionId: string) => {
    setPicks((current) => ({ ...current, [variationId]: optionId }))
    setRequired(false)
  }, [])
  const showRequired = useCallback(() => {
    setRequired(true)
    document.querySelector<HTMLInputElement>("input[data-product-option]")?.focus()
  }, [])

  return {
    status,
    product,
    variations: status === "ready" ? (product.variations ?? []) : [],
    picks,
    pick,
    selected,
    required,
    showRequired,
    retry,
  }
}
