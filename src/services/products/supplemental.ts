import type { GalleryRow, ProductMetadata } from "./adapter"

const PAGE = 500

const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "")
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

/**
 * Our own catalogue additions for one business, read with the public key
 * (both tables are public-read, write-denied). One paged read per table, not
 * per product. `select=*` keeps this working before and after additive
 * columns are applied. Empty tables are normal; a failed read is an error.
 *
 * Plain REST requests rather than the Supabase client: the catalogue gate
 * waits for these, and they then start with the page instead of after the
 * client library has downloaded.
 */
export async function loadSupplemental(businessId: number) {
  if (!url || !publishableKey) throw new Error("Catalogue metadata is not configured")
  const read = async <Row,>(table: "product_metadata" | "product_gallery") => {
    const rows: Row[] = []
    const order = table === "product_metadata" ? "product_id" : "id"
    for (let start = 0; ; start += PAGE) {
      const query = new URLSearchParams({
        select: "*",
        business_id: `eq.${businessId}`,
        order: `${order}.asc`,
        offset: String(start),
        limit: String(PAGE),
      })
      const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
        headers: { apikey: publishableKey, Accept: "application/json" },
        credentials: "omit",
      })
      const data = response.ok ? ((await response.json()) as Row[]) : undefined
      if (!Array.isArray(data)) throw new Error("Catalogue metadata request failed")
      rows.push(...data)
      if (data.length < PAGE) return rows
    }
  }
  const [metadata, gallery] = await Promise.all([
    read<ProductMetadata>("product_metadata"),
    read<GalleryRow>("product_gallery"),
  ])
  return { metadata, gallery }
}
