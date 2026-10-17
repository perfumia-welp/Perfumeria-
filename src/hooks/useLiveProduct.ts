import { useCallback, useEffect, useState } from "react"
import { useCatalogState } from "@/hooks/useCatalogState"
import { useI18n } from "@/i18n/i18nContext"
import {
  findProductForPage,
  loadProductDetail,
  productIdFromSlug,
} from "@/services/catalog"

export type DetailStatus = "loading" | "ready" | "error"

/**
 * The product of a product page. Live products fetch their company detail
 * on first view (options, freshest price and availability); until then the
 * catalogue listing is shown if it is already loaded. Mock products are
 * ready at once and fetch nothing.
 */
export function useLiveProduct(slug: string) {
  const { locale } = useI18n()
  const catalog = useCatalogState()
  const productId = productIdFromSlug(slug)
  const [status, setStatus] = useState<DetailStatus>(productId ? "loading" : "ready")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!productId) return
    let active = true
    setStatus("loading")
    loadProductDetail(productId).then(
      () => active && setStatus("ready"),
      () => active && setStatus("error"),
    )
    return () => {
      active = false
    }
  }, [productId, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  return {
    product: findProductForPage(slug, locale),
    detailStatus: productId ? status : ("ready" as DetailStatus),
    retry,
    catalog,
  }
}
