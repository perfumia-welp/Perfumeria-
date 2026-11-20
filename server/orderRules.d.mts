export declare const BUSINESS_URL: string
export declare const ORDER_RULES_TTL_MS: number
export declare const ORDER_RULES_FAILURE_COOLDOWN_MS: number

export declare class OrderRulesUnavailableError extends Error {
  constructor(detail?: Record<string, unknown>)
  detail: Record<string, unknown>
}

export declare function parseMinimumOrderAmount(record: unknown): number
export declare function fetchMinimumOrderAmount(): Promise<number>

export interface OrderRulesSource {
  get(): Promise<{ minimumOrderSubtotal: number }>
}

export declare function createOrderRules(options?: {
  fetchMinimum?: () => Promise<number>
  ttlMs?: number
  failureCooldownMs?: number
  now?: () => number
}): OrderRulesSource
