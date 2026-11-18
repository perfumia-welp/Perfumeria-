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
 * @param {{ id: string, unitCents: number, quantity: number }[]} lines
 *   Payable lines: `unitCents` is the verified price of one unit in cents.
 */
export function buy4Promotion(lines) {
  if (!Array.isArray(lines)) throw new TypeError("buy4Promotion: lines must be an array")
  let unitCount = 0
  let subtotalCents = 0
  for (const line of lines) {
    if (typeof line?.id !== "string" || !line.id
      || !Number.isSafeInteger(line.unitCents) || line.unitCents < 0
      || !Number.isSafeInteger(line.quantity) || line.quantity < 1)
      throw new TypeError("buy4Promotion: invalid line")
    unitCount += line.quantity
    subtotalCents += line.unitCents * line.quantity
  }
  const freeUnitCount = Math.floor(unitCount / BUY4_GROUP_SIZE)

  // Cheapest first; equal prices by line id, so ties never depend on order.
  const ranked = [...lines].sort((a, b) =>
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
    freeUnitCount,
    /** Product subtotal before the promotion (verified unit prices x quantity). */
    subtotalCents,
    discountCents,
    /** What the customer pays for the products. */
    totalCents: subtotalCents - discountCents,
    freeLines,
    /** Units to add before the next free unit (4 - units % 4). */
    unitsToNextFree: BUY4_GROUP_SIZE - (unitCount % BUY4_GROUP_SIZE),
  }
}
