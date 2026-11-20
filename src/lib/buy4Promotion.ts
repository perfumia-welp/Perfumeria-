import { buy4Promotion } from "../../shared/buy4Promotion.mjs"

/**
 * Buy 3, Get the 4th Free, priced for the storefront. The rule itself
 * lives once in shared/buy4Promotion.mjs, which POST /api/orders runs on
 * the verified prices; this only converts amounts. The server's result is
 * the authority: the bag and checkout show the same numbers because they
 * run the same function on the same current prices.
 */
export interface BagPromotion {
  /** Units in the bag (quantities count). */
  unitCount: number
  /** Units that count toward the offer (Perfume Boxes do not). */
  eligibleUnitCount: number
  /** Perfume Box units in the bag: paid in full, never free. */
  excludedUnitCount: number
  /** Free units: one for every 4. */
  freeUnits: number
  /** Product subtotal before the promotion. */
  subtotal: number
  /** Amount taken off by the promotion (0 when the bag does not qualify). */
  discount: number
  /** What the customer pays for the products. */
  total: number
  /** Free units per line id (only lines with a free unit). */
  freeByLine: ReadonlyMap<string, number>
  /** Eligible units still to add before the next free unit. */
  unitsToNextFree: number
}

export interface PromotionLineInput {
  id: string
  /** Current payable unit price (after sale, of the chosen option). */
  unitPrice: number
  quantity: number
  /** False for Perfume Boxes (product.giftSet): never counted, never free. */
  eligible: boolean
}

export function bagPromotion(lines: PromotionLineInput[]): BagPromotion {
  const result = buy4Promotion(
    lines.map((line) => ({
      id: line.id,
      unitCents: Math.round(line.unitPrice * 100),
      quantity: line.quantity,
      eligible: line.eligible,
    })),
  )
  return {
    unitCount: result.unitCount,
    eligibleUnitCount: result.eligibleUnitCount,
    excludedUnitCount: result.excludedUnitCount,
    freeUnits: result.freeUnitCount,
    subtotal: result.subtotalCents / 100,
    discount: result.discountCents / 100,
    total: result.totalCents / 100,
    freeByLine: new Map(
      result.freeLines.map((line) => [line.id, line.freeQuantity]),
    ),
    unitsToNextFree: result.unitsToNextFree,
  }
}
