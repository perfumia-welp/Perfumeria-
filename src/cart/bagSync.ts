import type { StoredBagLine } from "@/services/cart"

/*
 * The bag's save journal. A bag change shows at once and is saved to
 * Supabase a moment later; a full page load (hard refresh, a typed URL)
 * in between would cancel the save. So, before the change is painted, the
 * bag writes a small journal to localStorage: the lines the database last
 * confirmed (`base`) and the lines the shopper sees (`lines`), as line ids
 * and quantities only. Once everything is saved the journal is removed.
 *
 * On the next load the journal is applied with a three-way merge per line
 * (see mergeLines), so a save that did reach the database before the page
 * went away is never applied twice, and a change made meanwhile on another
 * device is kept.
 *
 * A visitor with no Supabase identity yet (the first Add to Bag starts one)
 * has a journal without a base: those lines are carried into the next bag
 * that loads, exactly as the bag on screen is.
 */

const PREFIX = "perfumira:bag-sync:"
const TAB_KEY = "perfumira:tab"
export const VISITOR = "visitor"
/** Another tab's journal is applied only once that tab has had time to save it. */
const OTHER_TAB_GRACE_MS = 30_000
/** Journals this old are dropped unapplied. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export interface BagJournal {
  /** The saved lines the change started from; null for a visitor's lines. */
  base: StoredBagLine[] | null
  lines: StoredBagLine[]
}

interface StoredJournal extends BagJournal {
  v: 1
  at: number
}

export interface FoundJournal extends BagJournal {
  key: string
}

let tabId: string | undefined

/** This tab's id: kept across reloads of the tab, new for a new tab. */
function currentTab() {
  if (tabId) return tabId
  try {
    tabId = sessionStorage.getItem(TAB_KEY) ?? undefined
    if (!tabId) {
      tabId = Math.random().toString(36).slice(2, 10)
      sessionStorage.setItem(TAB_KEY, tabId)
    }
  } catch {
    tabId ??= Math.random().toString(36).slice(2, 10)
  }
  return tabId
}

/** This tab's journal key for an owner. */
export const journalKey = (owner: string) => `${PREFIX}${owner}:${currentTab()}`
const keyFor = journalKey

const isLine = (value: unknown): value is StoredBagLine =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as StoredBagLine).id === "string" &&
  Number.isInteger((value as StoredBagLine).quantity) &&
  (value as StoredBagLine).quantity > 0

function parse(raw: string | null): StoredJournal | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as StoredJournal
    if (
      value?.v !== 1 ||
      typeof value.at !== "number" ||
      !Array.isArray(value.lines) ||
      !value.lines.every(isLine) ||
      !(
        value.base === null ||
        (Array.isArray(value.base) && value.base.every(isLine))
      )
    )
      return null
    return value
  } catch {
    return null
  }
}

/** Saves this tab's journal for a bag owner (or VISITOR). */
export function writeJournal(owner: string, journal: BagJournal) {
  try {
    const value: StoredJournal = {
      v: 1,
      at: Date.now(),
      base:
        journal.base &&
        journal.base.map(({ id, quantity }) => ({ id, quantity })),
      lines: journal.lines.map(({ id, quantity }) => ({ id, quantity })),
    }
    localStorage.setItem(keyFor(owner), JSON.stringify(value))
  } catch {
    /* Storage may be full or disabled: the bag still saves as before. */
  }
}

export function removeJournal(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* Optional storage. */
  }
}

export const removeOwnJournal = (owner: string) => removeJournal(keyFor(owner))

/**
 * The journals to apply for an owner: this tab's, and other tabs' that are
 * old enough that the tab is surely gone or done. Expired ones are removed.
 */
export function readJournals(owner: string): FoundJournal[] {
  const found: FoundJournal[] = []
  try {
    const prefix = `${PREFIX}${owner}:`
    const own = keyFor(owner)
    const now = Date.now()
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index)
      if (!key?.startsWith(prefix)) continue
      const journal = parse(localStorage.getItem(key))
      if (!journal || now - journal.at > MAX_AGE_MS) {
        removeJournal(key)
        continue
      }
      if (key !== own && now - journal.at < OTHER_TAB_GRACE_MS) continue
      found.push({ key, base: journal.base, lines: journal.lines })
    }
  } catch {
    /* Storage may be disabled. */
  }
  return found
}

const quantityOf = (lines: StoredBagLine[], id: string) =>
  lines.find((line) => line.id === id)?.quantity ?? 0

/**
 * Three-way merge of one journal into the saved bag. Per line: if the saved
 * quantity is still the base, or lies between the base and the journal's
 * quantity (part of the change was saved), the journal's quantity wins;
 * otherwise the line was changed elsewhere and the saved quantity stays.
 * Quantities are absolute, so applying a journal twice changes nothing.
 */
export function mergeLines(
  saved: StoredBagLine[],
  base: StoredBagLine[],
  wanted: StoredBagLine[],
): StoredBagLine[] {
  const ids = [
    ...saved.map((line) => line.id),
    ...wanted
      .map((line) => line.id)
      .filter((id) => !saved.some((line) => line.id === id)),
  ]
  const result: StoredBagLine[] = []
  for (const id of ids) {
    const s = quantityOf(saved, id)
    const b = quantityOf(base, id)
    const w = quantityOf(wanted, id)
    const quantity = s >= Math.min(b, w) && s <= Math.max(b, w) ? w : s
    if (quantity > 0) result.push({ id, quantity })
  }
  return result
}

/** Adds a visitor's lines on top of a bag (same line: quantities add, capped). */
export function addLines(
  lines: StoredBagLine[],
  added: StoredBagLine[],
  max: number,
): StoredBagLine[] {
  const result = lines.map((line) => ({ ...line }))
  for (const line of added) {
    const existing = result.find((item) => item.id === line.id)
    if (existing)
      existing.quantity = Math.min(max, existing.quantity + line.quantity)
    else result.push({ id: line.id, quantity: Math.min(max, line.quantity) })
  }
  return result
}

export const sameLines = (a: StoredBagLine[], b: StoredBagLine[]) =>
  a.length === b.length &&
  a.every((line) => quantityOf(b, line.id) === line.quantity)
