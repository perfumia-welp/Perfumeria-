import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useI18n } from "@/i18n/i18nContext"
import { productPath } from "@/router/paths"
import { router } from "@/router/router"
import { useCatalogState } from "@/hooks/useCatalogState"
import { findProduct } from "@/services/catalog"
import type { Product } from "@/types/catalog"
import type { CartItem } from "@/types/commerce"
import {
  BagContext,
  MAX_QUANTITY,
  MIN_QUANTITY,
  type BagGift,
} from "./bagContext"
import "./BagNotice.css"

const NOTICE_DURATION_MS = 2200

const NO_GIFT: BagGift = { isGift: false, message: "" }

interface RemovedLine {
  item: CartItem
  index: number
}

/*
 * Session-only mock cart. The bag starts empty; nothing is persisted or
 * priced server-side. Replace this provider with the cart API integration.
 * Lines are exposed with their products in the current language, so the
 * bag, quantities, gift and promo survive a language switch unchanged.
 */
export default function BagProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [removed, setRemoved] = useState<RemovedLine | null>(null)
  const [gift, setGift] = useState<BagGift>(NO_GIFT)
  const [promoCode, setPromoCode] = useState("")
  /** Id of the product just added; the notice text is built at render. */
  const [notice, setNotice] = useState("")
  const { t, locale, localize } = useI18n()
  // Re-localize lines when the live catalogue or a product detail arrives.
  const { version } = useCatalogState()
  const noticeTimer = useRef<number | undefined>(undefined)

  const addItem = useCallback((product: Product, quantity = 1) => {
    // A product with company options (box / no box) needs a pick first, which
    // happens on its product page; a card's Add to Bag takes the shopper there.
    if (product.requiresOptionSelection && !product.selectedOptions) {
      void router.navigate(localize(productPath(product.slug)))
      return
    }
    const added = Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, quantity))
    setItems((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      if (!existing) return [...current, { product, quantity: added }]
      return current.map((item) =>
        item === existing
          ? {
              ...item,
              quantity: Math.min(MAX_QUANTITY, item.quantity + added),
            }
          : item,
      )
    })
    setNotice(product.id)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(
      () => setNotice(""),
      NOTICE_DURATION_MS,
    )
  }, [localize])

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const next = Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, quantity))
    setItems((current) =>
      current.map((item) =>
        item.product.id === productId ? { ...item, quantity: next } : item,
      ),
    )
  }, [])

  const removeItem = useCallback(
    (productId: string) => {
      const index = items.findIndex((item) => item.product.id === productId)
      if (index === -1) return
      setRemoved({ item: items[index], index })
      setItems(items.filter((_, itemIndex) => itemIndex !== index))
    },
    [items],
  )

  const undoRemove = useCallback(() => {
    if (!removed) return
    setItems((current) => [
      ...current.slice(0, removed.index),
      removed.item,
      ...current.slice(removed.index),
    ])
    setRemoved(null)
  }, [removed])

  const clearRemoved = useCallback(() => setRemoved(null), [])

  const clearBag = useCallback(() => {
    setItems([])
    setRemoved(null)
    setGift(NO_GIFT)
    setPromoCode("")
  }, [])

  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  const localizedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        product: findProduct(item.product.id, locale) ?? item.product,
      })),
    [items, locale, version],
  )

  const value = useMemo(
    () => ({
      items: localizedItems,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: items.reduce(
        (total, item) => total + item.product.price * item.quantity,
        0,
      ),
      addItem,
      setQuantity,
      removeItem,
      lastRemoved: removed
        ? {
            ...removed.item,
            product:
              findProduct(removed.item.product.id, locale) ??
              removed.item.product,
          }
        : null,
      undoRemove,
      clearRemoved,
      gift,
      setGift,
      promoCode,
      setPromoCode,
      clearBag,
    }),
    [
      items,
      localizedItems,
      locale,
      removed,
      addItem,
      setQuantity,
      removeItem,
      undoRemove,
      clearRemoved,
      gift,
      promoCode,
      clearBag,
    ],
  )

  return (
    <BagContext.Provider value={value}>
      {children}
      <div className={`bag-notice${notice ? " is-visible" : ""}`} role="status">
        {notice && t.cart.added(findProduct(notice, locale)?.name ?? "")}
      </div>
    </BagContext.Provider>
  )
}
