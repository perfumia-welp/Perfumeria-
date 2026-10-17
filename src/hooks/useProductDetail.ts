import { useEffect } from "react"
import { useCatalogState } from "@/hooks/useCatalogState"
import { useI18n } from "@/i18n/i18nContext"
import { getProductDetail, loadProductDetail } from "@/services/catalog"
import type { Product } from "@/types/catalog"

/**
 * The company detail (with options) of a live product, fetched on first
 * use and shared by every component showing that product; once per product
 * per visit. Pass undefined when no detail is needed.
 */
export function useProductDetail(product?: Product) {
  const { locale } = useI18n()
  useCatalogState()
  const productId = product?.productId
  useEffect(() => {
    if (productId !== undefined) void loadProductDetail(productId).catch(() => {})
  }, [productId])
  return productId !== undefined ? getProductDetail(productId, locale) : undefined
}
