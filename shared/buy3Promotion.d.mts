/* Types for shared/buy3Promotion.mjs (the storefront imports it from TypeScript). */

export declare const BUY3_PROMOTION_ID: "buy3-cheapest-free"
export declare const BUY3_GROUP_SIZE: 3

export interface Buy3PromotionLine {
  id: string
  /** Verified price of one unit, in integer cents. */
  unitCents: number
  quantity: number
}

export interface Buy3FreeLine {
  id: string
  freeQuantity: number
  discountCents: number
}

export interface Buy3PromotionResult {
  unitCount: number
  freeUnitCount: number
  subtotalCents: number
  discountCents: number
  totalCents: number
  freeLines: Buy3FreeLine[]
  unitsToNextFree: number
}

export declare function buy3Promotion(
  lines: Buy3PromotionLine[],
): Buy3PromotionResult
