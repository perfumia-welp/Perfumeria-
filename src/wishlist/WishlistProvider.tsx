import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useI18n } from "@/i18n/i18nContext"
import { useCatalogState } from "@/hooks/useCatalogState"
import { findProduct } from "@/services/catalog"
import {
  loadWishlist,
  saveWishlist,
  subscribeToWishlist,
} from "@/services/wishlist"
import type { Product } from "@/types/catalog"
import { WishlistContext } from "./wishlistContext"

/*
 * Wishlist state for the whole site, persisted through the wishlist adapter.
 * Ids are kept as stored; ids no longer in the catalogue are simply not
 * shown, so a temporarily missing product is not lost. Products are looked
 * up in the current language, so a language switch keeps the list and
 * re-reads its text.
 */

/** Named rather than inline: oxfmt 0.2.0 mangles single-line object types. */
interface Announcement {
  productId: string
  saved: boolean
}
export default function WishlistProvider({
  children,
}: {
  children: ReactNode
}) {
  const [ids, setIds] = useState<string[]>(loadWishlist)
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const { t, locale } = useI18n()
  const { version } = useCatalogState()
  /** Skips saving the list that was just loaded or received from another tab. */
  const persisted = useRef(ids)

  useEffect(() => {
    if (persisted.current === ids) return
    persisted.current = ids
    saveWishlist(ids)
  }, [ids])

  useEffect(
    () =>
      subscribeToWishlist((next) => {
        persisted.current = next
        setIds(next)
      }),
    [],
  )

  const add = useCallback((product: Product) => {
    setIds((current) =>
      current.includes(product.id) ? current : [...current, product.id],
    )
    setAnnouncement({ productId: product.id, saved: true })
  }, [])

  const remove = useCallback((productId: string) => {
    setIds((current) => current.filter((id) => id !== productId))
    setAnnouncement({ productId, saved: false })
  }, [])

  const value = useMemo(() => {
    const products = ids
      .map((id) => findProduct(id, locale))
      .filter((product): product is Product => Boolean(product))
    const has = (productId: string) => ids.includes(productId)
    return {
      products,
      count: products.length,
      has,
      add,
      remove,
      toggle: (product: Product) => {
        if (has(product.id)) {
          remove(product.id)
          return false
        }
        add(product)
        return true
      },
    }
  }, [ids, add, remove, locale, version])

  const announced = announcement && findProduct(announcement.productId, locale)
  const announcementText = !announced
    ? ""
    : announcement.saved
      ? t.wishlist.saved(announced.name)
      : t.wishlist.removed(announced.name)

  return (
    <WishlistContext.Provider value={value}>
      {children}
      <p className="visually-hidden" role="status">
        {announcementText}
      </p>
    </WishlistContext.Provider>
  )
}
