/* Types for shared/buy4Promotion.mjs (the storefront imports it from TypeScript). */

export declare const BUY4_PROMOTION_ID: "buy4-cheapest-free"
export declare const BUY4_GROUP_SIZE: 4

export interface Buy4PromotionLine {
  id: string
  /** Verified price of one unit, in integer cents. */
  unitCents: number
  quantity: number
}

export interface Buy4FreeLine {
  id: string
  freeQuantity: number
  discountCents: number
}

export interface Buy4PromotionResult {
  unitCount: number
  freeUnitCount: number
  subtotalCents: number
  discountCents: number
  totalCents: number
  freeLines: Buy4FreeLine[]
  unitsToNextFree: number
}

export declare function buy4Promotion(
  lines: Buy4PromotionLine[],
): Buy4PromotionResult
