import { loadSupabase } from "../../lib/supabase"
import type { GalleryRow, ProductMetadata } from "./adapter"

const PAGE = 500

/**
 * Our own catalogue additions for one business, read with the public key
 * (both tables are public-read, write-denied). One paged read per table, not
 * per product. `select("*")` keeps this working before and after additive
 * columns are applied. Empty tables are normal; a failed read is an error.
 */
export async function loadSupplemental(businessId: number) {
  const client = await loadSupabase()
  if (!client) throw new Error("Catalogue metadata is not configured")
  const read = async <Row,>(table: "product_metadata" | "product_gallery") => {
    const rows: Row[] = []
    for (let start = 0; ; start += PAGE) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .eq("business_id", businessId)
        .order(table === "product_metadata" ? "product_id" : "id")
        .range(start, start + PAGE - 1)
      if (error || !data) throw new Error("Catalogue metadata request failed")
      rows.push(...(data as Row[]))
      if (data.length < PAGE) return rows
    }
  }
  const [metadata, gallery] = await Promise.all([
    read<ProductMetadata>("product_metadata"),
    read<GalleryRow>("product_gallery"),
  ])
  return { metadata, gallery }
}
