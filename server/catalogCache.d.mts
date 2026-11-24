export declare const ALL_PRODUCTS_URL: string
export declare const CATALOG_FRESH_MS: number
export declare const CATALOG_MAX_STALE_MS: number
export declare const CATALOG_REFRESH_MS: number
export declare const CATALOG_FAILURE_COOLDOWN_MS: number

export declare class CatalogUnavailableError extends Error {
  constructor(detail?: Record<string, unknown>)
  detail: Record<string, unknown>
}

export declare function validCatalogBody(body: unknown): boolean
export declare function fetchAllProducts(): Promise<string>

export interface CatalogCopy {
  get(): Promise<{ json: string; age: number }>
  /** Reads now and every refresh interval; returns a function that stops it. */
  warm(): () => void
}

export declare function createCatalogCache(options?: {
  fetchCatalog?: () => Promise<string>
  freshMs?: number
  maxStaleMs?: number
  refreshMs?: number
  failureCooldownMs?: number
  now?: () => number
  log?: (message: string, detail?: unknown) => void
}): CatalogCopy
