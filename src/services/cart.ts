import { LIVE_CATALOG } from "@/config/catalog"
import { loadSupabase } from "@/lib/supabase"
import { OPTION_SEPARATOR } from "@/services/products/adapter"

/*
 * Bag adapter for signed-in customers: their bag lines live in Supabase
 * (public.cart_items, supabase/migrations/20261019090000_cart_items.sql).
 * A row holds only the company product id, the picked company option ids and
 * a quantity; name, image, price, stock and option labels always come from
 * the live catalogue. Every request runs as the signed-in customer with the
 * publishable key, so row level security limits it to their own rows and
 * the owner is always the session user. Failures throw; BagProvider decides
 * what the customer sees.
 */

/** A stored bag line, identified like the bag: "14106" or "14106~12285". */
export interface StoredBagLine {
  id: string
  quantity: number
}

interface CartRow {
  product_id: number
  option_ids: number[]
  quantity: number
}

const businessId = LIVE_CATALOG.businessId

/** Company product id and option ids of a bag line id, or null if it is not a live line. */
export function parseLineId(id: string) {
  const parts = id.split(OPTION_SEPARATOR).map(Number)
  if (!parts.every((part) => Number.isSafeInteger(part) && part > 0)) return null
  const [productId, ...optionIds] = parts
  return { productId, optionIds }
}

const lineId = (row: CartRow) =>
  [row.product_id, ...row.option_ids].join(OPTION_SEPARATOR)

const toLine = (row: CartRow): StoredBagLine => ({
  id: lineId(row),
  quantity: row.quantity,
})

async function client() {
  const supabase = await loadSupabase()
  if (!supabase) throw new Error("Supabase is not configured")
  return supabase
}

/** The line's row filter: same business, product and options. */
function identify(id: string) {
  const parsed = parseLineId(id)
  if (!parsed) throw new Error(`Not a live bag line: ${id}`)
  return {
    product_id: parsed.productId,
    option_ids: `{${parsed.optionIds.join(",")}}`,
  }
}

/** The customer's bag, oldest line first. */
export async function listBagLines(): Promise<StoredBagLine[]> {
  const supabase = await client()
  const { data, error } = await supabase
    .from("cart_items")
    .select("product_id, option_ids, quantity")
    .eq("business_id", businessId)
    .order("created_at")
  if (error) throw error
  return (data as CartRow[]).map(toLine)
}

/** Adds `quantity` of a line (or raises the existing line) and returns the stored line. */
export async function addBagLine(id: string, quantity: number) {
  const parsed = parseLineId(id)
  if (!parsed) throw new Error(`Not a live bag line: ${id}`)
  const supabase = await client()
  const { data, error } = await supabase
    .rpc("add_cart_item", {
      p_business_id: businessId,
      p_product_id: parsed.productId,
      p_option_ids: parsed.optionIds,
      p_quantity: quantity,
    })
    .single()
  if (error) throw error
  return toLine(data as CartRow)
}

export async function setBagLineQuantity(id: string, quantity: number) {
  const supabase = await client()
  const { error } = await supabase
    .from("cart_items")
    .update({ quantity })
    .eq("business_id", businessId)
    .match(identify(id))
  if (error) throw error
}

export async function removeBagLine(id: string) {
  const supabase = await client()
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("business_id", businessId)
    .match(identify(id))
  if (error) throw error
}

/** Empties the customer's bag (after an order request is done). */
export async function clearBagLines() {
  const supabase = await client()
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("business_id", businessId)
  if (error) throw error
}
