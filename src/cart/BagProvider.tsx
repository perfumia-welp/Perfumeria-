import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "@/auth/authContext"
import { useI18n } from "@/i18n/i18nContext"
import type { Locale } from "@/i18n/locales"
import { bagPromotion } from "@/lib/buy4Promotion"
import { metaAddToCart } from "@/lib/metaEvents"
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
import {
  VISITOR,
  addLines,
  journalKey,
  mergeLines,
  readJournals,
  removeJournal,
  removeOwnJournal,
  sameLines,
  writeJournal,
} from "./bagSync"
import "./BagNotice.css"

const NOTICE_DURATION_MS = 2200
/** The longer "kept for this visit only" notice stays up long enough to read. */
const VISIT_NOTICE_DURATION_MS = 5000

/** How long a failed save waits before it counts (see stillHere). */
const FAILURE_SETTLE_MS = 1000

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

/** `forVisit`: the visitor's bag cannot be saved, so it lasts for this visit. */
type Notice =
  | { kind: "added"; id: string; forVisit?: boolean }
  | { kind: "error" }
  | null

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

const toStored = (lines: BagLine[]): StoredBagLine[] =>
  lines.map(({ id, quantity }) => ({ id, quantity }))

const savedQuantity = (lines: StoredBagLine[], id: string) =>
  lines.find((line) => line.id === id)?.quantity ?? 0

const clampQuantity = (quantity: number) =>
  Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, quantity))

let restoredVisit: { lines: BagLine[]; keys: string[] } | undefined

/**
 * A visitor's lines that a full page load interrupted before they reached a
 * saved bag (see bagSync). Read once per page.
 */
function restoredVisitorLines() {
  if (restoredVisit) return restoredVisit
  restoredVisit = { lines: [], keys: [] }
  if (!live) return restoredVisit
  let lines: StoredBagLine[] = []
  for (const journal of readJournals(VISITOR)) {
    lines = addLines(lines, journal.lines, MAX_QUANTITY)
    restoredVisit.keys.push(journal.key)
  }
  restoredVisit.lines = lines
  return restoredVisit
}

/*
 * The bag. On the live catalogue every bag lives in Supabase (services/
 * cart.ts) under its owner: a signed-in customer, or a visitor's anonymous
 * guest identity, started on their first Add to Bag. Every change shows at
 * once; one sync loop then brings the saved bag to what is shown, in order
 * (several quick changes go out together). If a save fails, the bag goes
 * back to what is really saved and says so. When a guest signs in, their
 * lines are added to the account's bag; when a customer signs out, their
 * bag stays with the account. Without anonymous sign-ins a guest's bag lasts
 * for the visit.
 *
 * Until a change is saved, a small journal of line ids and quantities is
 * kept in localStorage (bagSync.ts), written before the change is painted:
 * a hard refresh or a typed URL right after Add to Bag finishes the save on
 * the next page instead of losing it, without applying anything twice.
 * Product data is never stored: lines are shown from the current catalogue
 * in the current language. Gift, promo and the Undo offer last for the visit.
 */
export default function BagProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<BagLine[]>(() => restoredVisitorLines().lines)
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
  /**
   * The owner's lines as the database last confirmed them, once loaded
   * (`knownOwner`). The sync loop saves the difference to the lines shown;
   * a failed save puts the bag back to this, so nothing unsaved looks saved.
   */
  const confirmed = useRef<StoredBagLine[]>([])
  const knownOwner = useRef<string | null>(null)
  const syncing = useRef(false)
  const syncAgain = useRef(false)
  /** The page is going away: requests are being cancelled, not failing. */
  const leaving = useRef(false)
  /** Anonymous sign-ins are off or failing: the visitor's bag is for this visit. */
  const guestUnavailable = useRef(false)
  const noticeTimer = useRef<number | undefined>(undefined)

  const showNotice = useCallback((next: Notice) => {
    setNotice(next)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(
      () => setNotice(null),
      next?.kind === "added" && next.forVisit
        ? VISIT_NOTICE_DURATION_MS
        : NOTICE_DURATION_MS,
    )
  }, [])

  useEffect(() => {
    const hide = () => {
      leaving.current = true
    }
    const show = () => {
      leaving.current = false
    }
    window.addEventListener("pagehide", hide)
    window.addEventListener("pageshow", show)
    return () => {
      window.removeEventListener("pagehide", hide)
      window.removeEventListener("pageshow", show)
    }
  }, [])

  /**
   * A request cancelled by a page load can fail before `pagehide` fires.
   * Failures wait a moment first: if the page is going away by then (or the
   * timer never fires because it is gone), nothing is undone or forgotten.
   */
  const stillHere = useCallback(
    () =>
      new Promise<boolean>((resolve) =>
        window.setTimeout(() => resolve(!leaving.current), FAILURE_SETTLE_MS),
      ),
    [],
  )

  /**
   * Writes (or removes) the journal for what is shown now: the owner's, once
   * their saved bag is known; otherwise the visitor's lines, which the next
   * owner to load takes over.
   */
  const persist = useCallback(() => {
    if (!live || leaving.current) return
    const current = toStored(linesRef.current)
    const forOwner = ownerRef.current
    if (forOwner && knownOwner.current === forOwner) {
      if (!syncing.current && sameLines(confirmed.current, current))
        removeOwnJournal(forOwner)
      else writeJournal(forOwner, { base: confirmed.current, lines: current })
      return
    }
    if (current.length === 0 || guestUnavailable.current) removeOwnJournal(VISITOR)
    else writeJournal(VISITOR, { base: null, lines: current })
  }, [])

  /**
   * Saves the difference between the lines shown and the confirmed lines,
   * repeating until they match. Only one loop runs at a time; a change made
   * while it runs is picked up by the next round.
   */
  const sync = useCallback(() => {
    if (!live) return
    if (syncing.current) {
      syncAgain.current = true
      return
    }
    const forOwner = ownerRef.current
    if (!forOwner || knownOwner.current !== forOwner) return
    const stillOwner = () =>
      ownerRef.current === forOwner && knownOwner.current === forOwner
    syncing.current = true
    void (async () => {
      try {
        rounds: for (;;) {
          syncAgain.current = false
          if (!stillOwner()) break
          const wanted = toStored(linesRef.current)
          if (sameLines(confirmed.current, wanted)) break
          if (wanted.length === 0) {
            await clearBagLines()
            if (!stillOwner()) break
            confirmed.current = []
            continue
          }
          for (const line of confirmed.current) {
            if (wanted.some((item) => item.id === line.id)) continue
            await removeBagLine(line.id)
            if (!stillOwner()) break rounds
            confirmed.current = confirmed.current.filter((item) => item.id !== line.id)
          }
          for (const line of wanted) {
            const before = savedQuantity(confirmed.current, line.id)
            if (line.quantity === before) continue
            // A saved line gets its new quantity; a new line is added.
            if (before > 0) {
              await setBagLineQuantity(line.id, line.quantity)
              if (!stillOwner()) break rounds
              confirmed.current = withStoredLine(confirmed.current, line)
              continue
            }
            const saved = await addBagLine(line.id, line.quantity - before)
            if (!stillOwner()) break rounds
            confirmed.current = withStoredLine(confirmed.current, saved)
            // The database adds to what it holds (another device may have
            // added too) and caps the quantity: show its count, keeping any
            // click made while the save was on its way.
            const drift = saved.quantity - line.quantity
            if (drift !== 0) {
              const adjust = (current: BagLine[]) =>
                current.map((item) =>
                  item.id === saved.id
                    ? { ...item, quantity: clampQuantity(item.quantity + drift) }
                    : item,
                )
              linesRef.current = adjust(linesRef.current)
              setLines(adjust)
            }
          }
        }
      } catch (error) {
        if (!(await stillHere())) return
        console.error("Saving the bag failed", error)
        if (!stillOwner()) return
        showNotice({ kind: "error" })
        setLines((current) => withSnapshots(confirmed.current, current))
        try {
          const saved = await listBagLines()
          if (!stillOwner()) return
          confirmed.current = saved
          setLines((current) => withSnapshots(saved, current))
        } catch (reloadError) {
          console.error("Reloading the saved bag failed", reloadError)
        }
      } finally {
        syncing.current = false
        persist()
        if (syncAgain.current) sync()
      }
    })()
  }, [persist, showNotice, stillHere])

  // Every change is journaled before it is painted, then saved.
  useLayoutEffect(() => {
    linesRef.current = lines
    persist()
    sync()
  }, [lines, persist, sync])

  // Visitor lines restored from another tab's journal now live in this tab's.
  useLayoutEffect(() => {
    const own = journalKey(VISITOR)
    for (const key of restoredVisitorLines().keys) if (key !== own) removeJournal(key)
  }, [])

  // A new owner (guest identity, sign-in) loads their saved bag, finishes any
  // save a page load interrupted, and adds the lines this visitor already
  // has. Sign-out empties the bag shown, which belongs to the account.
  useEffect(() => {
    if (authLoading) return
    const previous = ownerRef.current
    const previousWasGuest = ownerWasGuest.current
    if (owner === previous) return
    ownerRef.current = owner
    ownerWasGuest.current = ownerIsGuest
    knownOwner.current = null
    confirmed.current = []
    if (!owner) {
      setLoadedOwner(null)
      // A guest identity that ended keeps the visitor's lines on screen.
      if (previousWasGuest) return persist()
      setLines([])
      setRemoved(null)
      return
    }
    // Carried over: a visitor's lines, or a guest's lines when they sign in.
    const carry = !previous || previousWasGuest
    setLoadedOwner(null)
    persist()
    void (async () => {
      try {
        const saved = await listBagLines()
        if (ownerRef.current !== owner) return
        const journals = readJournals(owner)
        let wanted = saved
        for (const journal of journals)
          if (journal.base) wanted = mergeLines(wanted, journal.base, journal.lines)
        if (carry) wanted = addLines(wanted, toStored(linesRef.current), MAX_QUANTITY)
        // One step: the owner's journal takes over before the others go.
        confirmed.current = saved
        knownOwner.current = owner
        writeJournal(owner, { base: saved, lines: wanted })
        const own = journalKey(owner)
        for (const journal of journals) if (journal.key !== own) removeJournal(journal.key)
        removeOwnJournal(VISITOR)
        const next = withSnapshots(wanted, linesRef.current)
        linesRef.current = next
        setLines(next)
        setLoadedOwner(owner)
        sync()
      } catch (error) {
        if (!(await stillHere())) return
        console.error("Loading the saved bag failed", error)
        if (ownerRef.current !== owner) return
        setLoadedOwner(owner)
        showNotice({ kind: "error" })
      }
    })()
  }, [owner, ownerIsGuest, authLoading, persist, showNotice, stillHere, sync])

  // Lines restored after a page load (or kept when a guest identity ended)
  // need a guest identity to be saved, as on Add to Bag.
  const hasLines = lines.length > 0
  useEffect(() => {
    if (!live || authLoading || owner || !hasLines || guestUnavailable.current) return
    void startGuestSession().then(async (guestId) => {
      if (guestId || ownerRef.current || !(await stillHere())) return
      guestUnavailable.current = true
      persist()
    })
  }, [authLoading, owner, hasLines, startGuestSession, persist, stillHere])

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
      const added = clampQuantity(quantity)
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
      // Meta AddToCart once per Add to Bag, for the units really added (none
      // when the line is already at the maximum). Outside the state updater,
      // which React may run twice.
      const had = linesRef.current.find((line) => line.id === product.id)?.quantity ?? 0
      const units = Math.min(MAX_QUANTITY, had + added) - had
      if (units > 0) metaAddToCart(product, units)
      // A visitor's first line gives them a guest identity; the new owner
      // then saves the lines (see above). Until then the line is on screen.
      // Without one (anonymous sign-ins off or failing) the bag cannot be
      // saved, so the notice says it lasts for this visit only.
      if (live && !ownerRef.current)
        void startGuestSession().then(async (guestId) => {
          if (guestId || ownerRef.current || !(await stillHere())) return
          guestUnavailable.current = true
          persist()
          showNotice({ kind: "added", id: product.id, forVisit: true })
        })
    },
    [localize, persist, showNotice, startGuestSession, stillHere],
  )

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const next = clampQuantity(quantity)
    setLines((current) =>
      current.map((line) =>
        line.id === productId ? { ...line, quantity: next } : line,
      ),
    )
  }, [])

  const removeItem = useCallback(
    (productId: string) => {
      const index = lines.findIndex((line) => line.id === productId)
      if (index === -1) return
      setRemoved({ line: lines[index], index })
      setLines(lines.filter((_, lineIndex) => lineIndex !== index))
    },
    [lines],
  )

  const undoRemove = useCallback(() => {
    if (!removed) return
    const { line, index } = removed
    setLines((current) =>
      // Re-added since: the undone quantity joins that line.
      current.some((item) => item.id === line.id)
        ? current.map((item) =>
            item.id === line.id
              ? { ...item, quantity: clampQuantity(item.quantity + line.quantity) }
              : item,
          )
        : [...current.slice(0, index), line, ...current.slice(index)],
    )
    setRemoved(null)
  }, [removed])

  const clearRemoved = useCallback(() => setRemoved(null), [])

  const clearBag = useCallback(() => {
    setLines([])
    setRemoved(null)
    setGift(NO_GIFT)
    setPromoCode("")
  }, [])


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
    // Priced from the current catalogue, as each line is shown.
    const promotion = bagPromotion(
      resolved.items.map(({ product, quantity }) => ({
        id: product.id,
        unitPrice: product.price,
        quantity,
        // Perfume Boxes never count toward the offer and are never free.
        eligible: product.giftSet !== true,
      })),
    )
    return {
      items: resolved.items,
      unavailableItems: resolved.unavailableItems,
      isReady,
      // Lines that can be ordered or are still loading; not unavailable ones.
      itemCount:
        lines.reduce((total, line) => total + line.quantity, 0) -
        resolved.unavailableItems.reduce((total, line) => total + line.quantity, 0),
      subtotal: promotion.subtotal,
      promotion,
      total: promotion.total,
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
        ? (notice.forVisit ? t.cart.addedForVisit : t.cart.added)(
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
