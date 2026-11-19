export type OptionPriceEntry = { list: number; from: number }
export type OptionPriceMap = Record<string, OptionPriceEntry>

export declare const OPTION_PRICES_FRESH_MS: number
export declare const OPTION_PRICES_MAX_STALE_MS: number
export declare const OPTION_PRICES_FAILURE_COOLDOWN_MS: number
export declare const OPTION_PRICES_CONCURRENCY: number
export declare const OPTION_PRICES_CACHE_CONTROL: string

export declare class OptionPricesUnavailableError extends Error {
  constructor(detail?: Record<string, unknown>)
  detail: Record<string, unknown>
}

export declare function optionFromPrice(detail: unknown): number | undefined
export declare function welpGet(path: string): Promise<any>
export declare function buildOptionPriceIndex(options?: {
  get?: (path: string) => Promise<any>
  previous?: OptionPriceMap
  concurrency?: number
}): Promise<{ prices: OptionPriceMap; optionProducts: number; failed: number }>

export interface OptionPriceIndex {
  get(): Promise<{ prices: OptionPriceMap; at: number }>
  warm(): void
}

export declare function createOptionPriceIndex(options?: {
  build?: (previous: OptionPriceMap) => Promise<{ prices: OptionPriceMap; optionProducts: number; failed: number }>
  freshMs?: number
  maxStaleMs?: number
  failureCooldownMs?: number
  now?: () => number
  log?: (message: string, detail?: object) => void
}): OptionPriceIndex

export declare function optionPricesBody(index: { prices: OptionPriceMap; at: number }): {
  currency: string
  generatedAt: string
  prices: OptionPriceMap
}
