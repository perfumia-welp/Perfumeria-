import type { Gender, PriceRange } from "../types/catalog.ts"

/*
 * Live company catalogue (Welp public API, business 84116).
 *
 * The API is public: no token, no secret. Every value here is safe to ship
 * to the browser. Requests are GET only and use these fixed paths; nothing
 * from the URL or the page can change the host, business or path.
 */
export const LIVE_CATALOG = {
  apiBase: "https://api.welpstar.com/api/v1",
  businessId: 84116,
  /** Required by the API; confirm officially with the company before launch. */
  appId: "WEBSITE",
  /** Product images are absolute URLs on this host; relative paths resolve here. */
  mediaOrigin: "https://welp.fsn1.your-objectstorage.com",
  /**
   * TEMPORARY BUSINESS ASSUMPTION — the API does not return a currency.
   * The storefront sells in Egyptian pounds; confirm with the company.
   */
  currency: "EGP",
  /** Company product types are the shop's gender categories. */
  productTypeGender: { 1344: "men", 1382: "women" } as Record<number, Gender>,
  /** Price filter bands in EGP (min inclusive, max exclusive). */
  priceRanges: [
    { id: "under-1000", max: 1000 },
    { id: "1000-1200", min: 1000, max: 1200 },
    { id: "over-1200", min: 1200 },
  ] satisfies PriceRange[],
  /** Abort a catalogue request after this long rather than hang the gate. */
  timeoutMs: 20000,
} as const
