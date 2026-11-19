/**
 * Option "From" prices, as GET /api/catalog/option-prices
 * (server/optionPrices.mjs) returns them: product id -> the list price the
 * server saw and the cheapest required option's price (what the card shows).
 * Only products where the two differ are listed.
 */
export type OptionPriceMap = Record<string, { list: number; from: number }>

const isAmount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0

/**
 * One small same-origin request. Throws when unavailable or malformed; the
 * caller then keeps filtering and sorting by list price. Invalid entries are
 * dropped one by one.
 */
export async function fetchOptionPrices(): Promise<OptionPriceMap> {
  const response = await fetch(`${import.meta.env.BASE_URL}api/catalog/option-prices`, {
    headers: { Accept: "application/json" },
    credentials: "omit",
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`option prices ${response.status}`)
  const body = (await response.json()) as { prices?: unknown }
  if (!body?.prices || typeof body.prices !== "object" || Array.isArray(body.prices))
    throw new Error("option prices invalid")
  const prices: OptionPriceMap = {}
  for (const [id, entry] of Object.entries(body.prices as Record<string, unknown>)) {
    const { list, from } = (entry ?? {}) as { list?: unknown; from?: unknown }
    if (/^[1-9]\d{0,15}$/.test(id) && isAmount(list) && isAmount(from)) prices[id] = { list, from }
  }
  return prices
}
