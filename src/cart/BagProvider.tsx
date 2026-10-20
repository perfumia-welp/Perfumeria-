import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "@/auth/authContext"
import { useI18n } from "@/i18n/i18nContext"
import type { Locale } from "@/i18n/locales"
import { productPath } from "@/router/paths"
import { router } from "@/router/router"
import { useCatalogState } from "@/hooks/useCatalogState"
import {
  addBagLine,
  clearBagLines,
  listBagLines,
  parseLineId,
  removeBagLine,
  setBagLineQuantity,
  type StoredBagLine,
} from "@/services/cart"
import {
  findProduct,
  getProductDetail,
  loadProductDetail,
  productSource,
} from "@/services/catalog"
import type { Product } from "@/types/catalog"
import type { CartItem } from "@/types/commerce"
import {
  BagContext,
  MAX_QUANTITY,
  MIN_QUANTITY,
  type BagGift,
  type UnavailableBagLine,
} from "./bagContext"
import "./BagNotice.css"

const NOTICE_DURATION_MS = 2200

const NO_GIFT: BagGift = { isGift: false, message: "" }

/**
 * A bag line: its id ("14106", or "14106~12285" with company options) and
 * quantity. `snapshot` is the product as added during this visit; it only
 * stands in until the catalogue has loaded and is never saved.
 */
interface BagLine {
  id: string
  quantity: number
  snapshot?: Product
}

interface RemovedLine {
  line: BagLine
  index: number
}

type Notice = { kind: "added"; id: string } | { kind: "error" } | null

type Resolved =
  | { kind: "ready"; product: Product }
  | { kind: "unavailable"; name?: string }
  | { kind: "pending"; detailId?: number }

const live = productSource === "live"

/**
 * What a line is right now, from the current catalogue: orderable (with the
 * live name, image, price and options), unavailable (gone, sold out, or its
 * options changed), or still loading.
 */
function resolveLine(
  line: BagLine,
  locale: Locale,
  catalogComplete: boolean,
  failedDetails: ReadonlySet<number>,
): Resolved {
  const product = findProduct(line.id, locale)
  if (product)
    return product.inStock && !product.requiresOptionSelection
      ? { kind: "ready", product }
      : { kind: "unavailable", name: product.name }
  if (!live)
    return line.snapshot
      ? { kind: "ready", product: line.snapshot }
      : { kind: "unavailable" }
  const parsed = parseLineId(line.id)
  if (!parsed) return { kind: "unavailable", name: line.snapshot?.name }
  const listed = findProduct(String(parsed.productId), locale)
  const name = line.snapshot?.name ?? listed?.name
  const hasOptions = parsed.optionIds.length > 0
  // Options are checked against the product detail; fetch it if needed.
  const detailDone =
    getProductDetail(parsed.productId, locale) !== undefined ||
    failedDetails.has(parsed.productId)
  const detailId = hasOptions && !detailDone ? parsed.productId : undefined
  if (!catalogComplete)
    return line.snapshot
      ? { kind: "ready", product: line.snapshot }
      : { kind: "pending", detailId }
  if (!listed || !hasOptions || detailDone) return { kind: "unavailable", name }
  return { kind: "pending", detailId }
}

/** Saved lines, keeping this visit's snapshots for lines already shown. */
function withSnapshots(saved: StoredBagLine[], current: BagLine[]): BagLine[] {
  return saved.map((line) => ({
    ...line,
    snapshot: current.find((item) => item.id === line.id)?.snapshot,
  }))
}

/** The stored lines with one line added or replaced by its saved state. */
function withStoredLine(lines: StoredBagLine[], saved: StoredBagLine) {
  return lines.some((line) => line.id === saved.id)
    ? lines.map((line) => (line.id === saved.id ? saved : line))
    : [...lines, saved]
}

/** Applies the quantity the database returned for a line. */
function withSavedLine(current: BagLine[], saved: StoredBagLine, snapshot?: Product) {
  if (!current.some((line) => line.id === saved.id))
    return [...current, { ...saved, snapshot }]
  return current.map((line) =>
    line.id === saved.id ? { ...line, quantity: saved.quantity } : line,
  )
}

/*
 * The bag. On the live catalogue every bag lives in Supabase (services/
 * cart.ts) under its owner: a signed-in customer, or a visitor's anonymous
 * guest identity, started on their first Add to Bag. Every change shows at
 * once and is then saved in order; if a save fails, the bag goes back to
 * what is really saved and says so. When a guest signs in, their lines are
 * added to the account's bag; when a customer signs out, their bag stays
 * with the account. Without anonymous sign-ins a guest's bag lasts for the
 * visit. Nothing is written to browser storage except Supabase's session.
 * Product data is never stored: lines are shown from the current catalogue
 * in the current language. Gift, promo and the Undo offer last for the visit.
 */
export default function BagProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<BagLine[]>([])
  const [removed, setRemoved] = useState<RemovedLine | null>(null)
  const [gift, setGift] = useState<BagGift>(NO_GIFT)
  const [promoCode, setPromoCode] = useState("")
  const [notice, setNotice] = useState<Notice>(null)
  const [failedDetails, setFailedDetails] = useState<ReadonlySet<number>>(
    () => new Set(),
  )
  const { t, locale, localize } = useI18n()
  // Re-resolve lines when the live catalogue or a product detail arrives.
  const { version, complete } = useCatalogState()
  const {
    user,
    bagOwnerId,
    startGuestSession,
    isLoading: authLoading,
  } = useAuth()
  /** Whose bag this is: the customer's or the guest's Supabase id. */
  const owner = live ? bagOwnerId : null
  const ownerIsGuest = owner !== null && !user
  /** The account whose saved bag has been loaded into `lines`. */
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null)
  const ownerRef = useRef<string | null>(null)
  const ownerWasGuest = useRef(false)
  const linesRef = useRef(lines)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  /**
   * The signed-in customer's lines as the database last confirmed them. A
   * failed save puts the bag back to this, so nothing unsaved looks saved.
   */
  const confirmed = useRef<StoredBagLine[]>([])
  const noticeTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    linesRef.current = lines
  }, [lines])

  const showNotice = useCallback((next: Notice) => {
    setNotice(next)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(
      () => setNotice(null),
      NOTICE_DURATION_MS,
    )
  }, [])

  /**
   * Saves a change for the signed-in customer, after any earlier saves. The
   * task returns how the confirmed lines change once the database accepted it.
   * On failure the bag shows the confirmed lines again and says so.
   */
  const save = useCallback(
    (task: () => Promise<(lines: StoredBagLine[]) => StoredBagLine[]>) => {
      const forOwner = ownerRef.current
      if (!forOwner) return
      queue.current = queue.current
        .then(async () => {
          const apply = await task()
          if (ownerRef.current === forOwner)
            confirmed.current = apply(confirmed.current)
        })
        .catch(async (error) => {
          console.error("Saving the bag failed", error)
          if (ownerRef.current !== forOwner) return
          showNotice({ kind: "error" })
          setLines((current) => withSnapshots(confirmed.current, current))
          try {
            const saved = await listBagLines()
            if (ownerRef.current !== forOwner) return
            confirmed.current = saved
            setLines((current) => withSnapshots(saved, current))
          } catch (reloadError) {
            console.error("Reloading the saved bag failed", reloadError)
          }
        })
    },
    [showNotice],
  )

  // A new owner (guest identity, sign-in) loads their saved bag after adding
  // the lines this visitor already has. Sign-out empties the bag shown,
  // which belongs to the account.
  useEffect(() => {
    if (authLoading) return
    const previous = ownerRef.current
    const previousWasGuest = ownerWasGuest.current
    if (owner === previous) return
    ownerRef.current = owner
    ownerWasGuest.current = ownerIsGuest
    if (!owner) {
      confirmed.current = []
      // A guest identity that ended keeps the visitor's lines on screen.
      if (previousWasGuest) return setLoadedOwner(null)
      setLines([])
      setRemoved(null)
      setLoadedOwner(null)
      return
    }
    // Carried over: a visitor's lines, or a guest's lines when they sign in.
    const visitLines = !previous || previousWasGuest ? linesRef.current : []
    confirmed.current = []
    setLoadedOwner(null)
    queue.current = queue.current
      .then(async () => {
        for (const line of visitLines) await addBagLine(line.id, line.quantity)
        const saved = await listBagLines()
        if (ownerRef.current !== owner) return
        confirmed.current = saved
        setLines((current) => withSnapshots(saved, current))
        setLoadedOwner(owner)
      })
      .catch((error) => {
        console.error("Loading the saved bag failed", error)
        if (ownerRef.current !== owner) return
        setLoadedOwner(owner)
        showNotice({ kind: "error" })
      })
  }, [owner, ownerIsGuest, authLoading, showNotice])

  const addItem = useCallback(
    (product: Product, quantity = 1) => {
      // A product with company options (box / no box) needs a pick first, which
      // happens on its product page; a card's Add to Bag takes the shopper there
      // and the page asks for the choice.
      if (product.requiresOptionSelection && !product.selectedOptions) {
        void router.navigate(localize(productPath(product.slug)), {
          state: { chooseOption: true },
        })
        return
      }
      const added = Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, quantity))
      setLines((current) => {
        const existing = current.find((line) => line.id === product.id)
        if (!existing)
          return [...current, { id: product.id, quantity: added, snapshot: product }]
        return current.map((line) =>
          line === existing
            ? {
                ...line,
                snapshot: product,
                quantity: Math.min(MAX_QUANTITY, line.quantity + added),
              }
            : line,
        )
      })
      showNotice({ kind: "added", id: product.id })
      // A visitor's first line gives them a guest identity; the new owner
      // then saves the lines (see above). Until then the line is on screen.
      if (live && !ownerRef.current) void startGuestSession()
      save(async () => {
        const saved = await addBagLine(product.id, added)
        setLines((current) => withSavedLine(current, saved, product))
        return (lines) => withStoredLine(lines, saved)
      })
    },
    [localize, save, showNotice, startGuestSession],
  )

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      const next = Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, quantity))
      setLines((current) =>
        current.map((line) =>
          line.id === productId ? { ...line, quantity: next } : line,
        ),
      )
      save(async () => {
        await setBagLineQuantity(productId, next)
        return (lines) =>
          lines.map((line) =>
            line.id === productId ? { ...line, quantity: next } : line,
          )
      })
    },
    [save],
  )

  const removeItem = useCallback(
    (productId: string) => {
      const index = lines.findIndex((line) => line.id === productId)
      if (index === -1) return
      setRemoved({ line: lines[index], index })
      setLines(lines.filter((_, lineIndex) => lineIndex !== index))
      save(async () => {
        await removeBagLine(productId)
        return (lines) => lines.filter((line) => line.id !== productId)
      })
    },
    [lines, save],
  )

  const undoRemove = useCallback(() => {
    if (!removed) return
    const { line, index } = removed
    setLines((current) => [
      ...current.slice(0, index),
      line,
      ...current.slice(index),
    ])
    setRemoved(null)
    save(async () => {
      const saved = await addBagLine(line.id, line.quantity)
      setLines((current) => withSavedLine(current, saved, line.snapshot))
      return (lines) => withStoredLine(lines, saved)
    })
  }, [removed, save])

  const clearRemoved = useCallback(() => setRemoved(null), [])

  const clearBag = useCallback(() => {
    setLines([])
    setRemoved(null)
    setGift(NO_GIFT)
    setPromoCode("")
    save(async () => {
      await clearBagLines()
      return () => []
    })
  }, [save])

  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  const resolved = useMemo(() => {
    const items: CartItem[] = []
    const unavailableItems: UnavailableBagLine[] = []
    const detailIds = new Set<number>()
    let pending = 0
    for (const line of lines) {
      const result = resolveLine(line, locale, complete, failedDetails)
      if (result.kind === "ready")
        items.push({ product: result.product, quantity: line.quantity })
      else if (result.kind === "unavailable")
        unavailableItems.push({
          id: line.id,
          quantity: line.quantity,
          name: result.name,
        })
      else {
        pending += 1
        if (result.detailId !== undefined) detailIds.add(result.detailId)
      }
    }
    return { items, unavailableItems, pending, detailIds: [...detailIds] }
    // `version` changes when catalogue data arrives.
  }, [lines, locale, complete, failedDetails, version])

  // Fetch the detail of saved option lines, so their options can be checked
  // (the repository fetches each product once).
  const detailKey = resolved.detailIds.join(",")
  useEffect(() => {
    for (const id of detailKey ? detailKey.split(",").map(Number) : [])
      loadProductDetail(id).catch(() =>
        setFailedDetails((current) => new Set(current).add(id)),
      )
  }, [detailKey])

  const isReady =
    !(live && authLoading) &&
    (!owner || loadedOwner === owner) &&
    resolved.pending === 0

  const value = useMemo(() => {
    const removedResult =
      removed && resolveLine(removed.line, locale, complete, failedDetails)
    return {
      items: resolved.items,
      unavailableItems: resolved.unavailableItems,
      isReady,
      // Lines that can be ordered or are still loading; not unavailable ones.
      itemCount:
        lines.reduce((total, line) => total + line.quantity, 0) -
        resolved.unavailableItems.reduce((total, line) => total + line.quantity, 0),
      // Priced from the current catalogue, as each line is shown.
      subtotal: resolved.items.reduce(
        (total, item) => total + item.product.price * item.quantity,
        0,
      ),
      addItem,
      setQuantity,
      removeItem,
      lastRemoved:
        removed && removedResult?.kind === "ready"
          ? { product: removedResult.product, quantity: removed.line.quantity }
          : null,
      undoRemove,
      clearRemoved,
      gift,
      setGift,
      promoCode,
      setPromoCode,
      clearBag,
    }
  }, [
    resolved,
    isReady,
    lines,
    locale,
    complete,
    failedDetails,
    removed,
    addItem,
    setQuantity,
    removeItem,
    undoRemove,
    clearRemoved,
    gift,
    promoCode,
    clearBag,
  ])

  const noticeText =
    notice?.kind === "error"
      ? t.cart.saveError
      : notice?.kind === "added"
        ? t.cart.added(
            findProduct(notice.id, locale)?.name ??
              lines.find((line) => line.id === notice.id)?.snapshot?.name ??
              "",
          )
        : ""

  return (
    <BagContext.Provider value={value}>
      {children}
      <div className={`bag-notice${notice ? " is-visible" : ""}`} role="status">
        {noticeText}
      </div>
    </BagContext.Provider>
  )
}
