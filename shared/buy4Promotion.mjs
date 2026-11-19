/*
 * Buy 3, Get the 4th Free: the automatic bag promotion.
 *
 * The one implementation of the rule. The storefront (src/lib/buy4Promotion.ts)
 * and POST /api/orders (server/orders.mjs) both call buy4Promotion(), so the
 * bag, checkout and the stored order can never disagree. The server runs it
 * on the prices it verified with the company catalogue; it never reads a
 * discount, a free item or a price from the browser.
 *
 * Rule: every 4 units in the bag (quantities count, not lines) make 1 unit
 * free, and the free units are the cheapest payable units: the current price
 * after any sale, of the chosen option. Repeatable: 4-7 units = 1 free,
 * 8-11 = 2, 12 = 3. The discount never changes a product's price; it is a
 * separate amount taken off the product subtotal.
 *
 * Perfume Boxes are excluded (owner decision, 2026-11-19): a line with
 * `eligible: false` is paid in full, never counts toward the 4 and is never
 * made free, however cheap. Callers decide eligibility from the product's
 * own catalogue type (shared/perfumeSetName.mjs isPerfumeSetType, the same
 * Welp type list as the Perfume Boxes category), so future boxes are
 * excluded automatically; the server decides it from the verified product,
 * never from the browser. Orders stored before then counted boxes.
 *
 * Replaced Buy 3 — Cheapest Item Free (every 3 units, id
 * "buy3-cheapest-free") on 2026-11-18; only the group size changed. Orders
 * stored before then keep that id in their verified snapshot.
 *
 * Deterministic: units are ranked by price, then by line id (plain string
 * order, independent of bag order and locale), so the same bag always gives
 * the same free units. Amounts are integer cents, so nothing is rounded.
 */

export const BUY4_PROMOTION_ID = "buy4-cheapest-free"
/** Units needed for each free unit. */
export const BUY4_GROUP_SIZE = 4

/**
 * @param {{ id: string, unitCents: number, quantity: number, eligible?: boolean }[]} lines
 *   Payable lines: `unitCents` is the verified price of one unit in cents;
 *   `eligible: false` keeps a line out of the promotion (Perfume Boxes).
 */
export function buy4Promotion(lines) {
  if (!Array.isArray(lines)) throw new TypeError("buy4Promotion: lines must be an array")
  let unitCount = 0
  let eligibleUnitCount = 0
  let subtotalCents = 0
  for (const line of lines) {
    if (typeof line?.id !== "string" || !line.id
      || !Number.isSafeInteger(line.unitCents) || line.unitCents < 0
      || !Number.isSafeInteger(line.quantity) || line.quantity < 1
      || (line.eligible !== undefined && typeof line.eligible !== "boolean"))
      throw new TypeError("buy4Promotion: invalid line")
    unitCount += line.quantity
    if (line.eligible !== false) eligibleUnitCount += line.quantity
    subtotalCents += line.unitCents * line.quantity
  }
  const freeUnitCount = Math.floor(eligibleUnitCount / BUY4_GROUP_SIZE)

  // Eligible lines only, cheapest first; equal prices by line id, so ties
  // never depend on order.
  const ranked = lines.filter((line) => line.eligible !== false).sort((a, b) =>
    a.unitCents - b.unitCents || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const free = new Map()
  let remaining = freeUnitCount
  for (const line of ranked) {
    if (remaining === 0) break
    const take = Math.min(line.quantity - (free.get(line.id) ?? 0), remaining)
    if (take <= 0) continue
    free.set(line.id, (free.get(line.id) ?? 0) + take)
    remaining -= take
  }

  // Free lines in bag order, each with its share of the discount.
  const freeLines = []
  let discountCents = 0
  for (const line of lines) {
    const freeQuantity = free.get(line.id)
    if (!freeQuantity) continue
    free.delete(line.id)
    const lineDiscountCents = freeQuantity * line.unitCents
    discountCents += lineDiscountCents
    freeLines.push({ id: line.id, freeQuantity, discountCents: lineDiscountCents })
  }

  return {
    unitCount,
    /** Units that count toward the offer (all but Perfume Boxes). */
    eligibleUnitCount,
    /** Units the offer leaves out (Perfume Boxes). */
    excludedUnitCount: unitCount - eligibleUnitCount,
    freeUnitCount,
    /** Product subtotal before the promotion (verified unit prices x quantity). */
    subtotalCents,
    discountCents,
    /** What the customer pays for the products. */
    totalCents: subtotalCents - discountCents,
    freeLines,
    /** Eligible units to add before the next free unit (4 - eligible units % 4). */
    unitsToNextFree: BUY4_GROUP_SIZE - (eligibleUnitCount % BUY4_GROUP_SIZE),
  }
}
