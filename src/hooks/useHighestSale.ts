import { useEffect, useMemo, useState } from "react"
import { useCatalogState } from "@/hooks/useCatalogState"
import { useI18n } from "@/i18n/i18nContext"
import { cardSale, highestSalePercentage } from "@/lib/productSale"
import {
  getCatalog,
  getProductDetail,
  loadProductDetail,
  needsOptionChoice,
  productSource,
} from "@/services/catalog"
import type { Product } from "@/types/catalog"

/** Product details fetched at once while checking option sales. */
const DETAIL_CONCURRENCY = 4

/*
 * Option-priced products (with box / without box) carry their option prices
 * only in their detail, so their card sale is unknown from the listing. Those
 * the listing reports as discounted (the same signal that finds the Home
 * offers) have their detail loaded; their card sale then comes from their
 * cheapest option's own pair, exactly as on their card, never the listing's.
 */
const optionSaleCandidates = (products: Product[]) =>
  products.flatMap((product) =>
    product.productId !== undefined &&
    needsOptionChoice(product) &&
    !product.variations?.length &&
    product.compareAtPrice !== undefined
      ? [product.productId]
      : [],
  )

export type HighestSale =
  | { status: "pending" }
  | { status: "none" }
  | { status: "ready"; percentage: number }

/**
 * The highest discount any product card in the live catalogue shows, for
 * the homepage sale highlight. Pending until the full catalogue and the
 * option details it needs are in, so no provisional figure is ever shown;
 * "none" for the mock catalogue, a failed catalogue or no genuine sale.
 */
export function useHighestSale(): HighestSale {
  const { locale } = useI18n()
  const { version, complete, failed } = useCatalogState()
  const live = productSource === "live"
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!live || !complete || checked) return
    let cancelled = false
    const queue = optionSaleCandidates(getCatalog())
    const worker = async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift())
        // A detail that cannot be loaded leaves that product out: never guessed.
        await loadProductDetail(id).catch(() => {})
    }
    void Promise.all(
      Array.from({ length: Math.min(DETAIL_CONCURRENCY, queue.length) }, worker),
    ).then(() => {
      if (!cancelled) setChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [live, complete, checked])

  const percentage = useMemo(() => {
    if (!live || !complete || !checked) return undefined
    return highestSalePercentage(
      getCatalog(locale).map((product) =>
        cardSale(
          product,
          product.productId !== undefined
            ? getProductDetail(product.productId, locale)
            : undefined,
        ),
      ),
    )
  }, [live, complete, checked, locale, version])

  if (!live || (failed && !complete)) return { status: "none" }
  if (!complete || !checked) return { status: "pending" }
  return percentage === undefined ? { status: "none" } : { status: "ready", percentage }
}
