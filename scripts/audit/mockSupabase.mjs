/*
 * In-memory stand-in for the Supabase REST API (PostgREST) used by the
 * signed-in audits, so they never reach the real project. It serves only
 * the queries the account and checkout make, for one preview user, and
 * mirrors the database rules that matter to the UI (one default address,
 * first address is the default, orders created only through the RPC with
 * status request_created; the same reference again updates that order). The real rules and RLS are tested against
 * Postgres in database.mjs.
 */

export const PREVIEW_USER_ID = "00000000-0000-0000-0000-000000000001"

let counter = 0
const uuid = () =>
  `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`
const now = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86400000).toISOString()

/** Records for a fresh preview account: "seeded" (some history) or "empty". */
export function createAccountData(kind = "seeded") {
  const data = {
    profile: { id: PREVIEW_USER_ID, first_name: "Amira", last_name: "Preview", phone: "" },
    addresses: [],
    orders: [],
    /** Every RPC body received, for checks. */
    rpcCalls: [],
    /** Every write request the site made, for checks. */
    writes: [],
    /** Set to make every request fail (error states). */
    failAll: false,
    /** Delay before every answer, in ms (slow network). */
    delayMs: 0,
  }
  if (kind === "empty") return data
  data.profile.phone = "+20 100 000 0000"
  data.addresses.push({
    id: uuid(), user_id: PREVIEW_USER_ID, label: "Home", full_name: "Amira Preview",
    phone: "+20 100 000 0000", address: "18 Garden Promenade", city_area: "Cairo, Zamalek",
    is_default: true, created_at: now(-30),
  })
  data.orders.push(
    order("PF-260928-K7Q2", now(-11), [["quiet-oud", "Quiet Oud", "75 ml", 1, 179], ["velvet-iris", "Velvet Iris", "50 ml", 1, 138]]),
    order("PF-260812-M4TP", now(-58), [["quiet-oud", "Quiet Oud", "75 ml", 1, 179]]),
  )
  return data
}

function order(reference, createdAt, lines, extra = {}) {
  const id = uuid()
  const items = lines.map(([ref, name, size, quantity, price], index) => ({
    position: index + 1, product_ref: ref, product_name: name, size,
    quantity, unit_price: price, line_total: quantity * price, image_url: null,
  }))
  return {
    id, reference, user_id: PREVIEW_USER_ID, status: "request_created", created_at: createdAt,
    subtotal: items.reduce((sum, item) => sum + item.line_total, 0), currency: "USD",
    order_items: items, ...extra,
  }
}

const json = (route, status, body) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: body === undefined ? "" : JSON.stringify(body),
  })

/** Applies the "one default address" rules the database enforces. */
function settleDefault(addresses, changed) {
  if (changed?.is_default)
    for (const address of addresses) if (address !== changed) address.is_default = false
  if (addresses.length && !addresses.some((address) => address.is_default))
    [...addresses].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].is_default = true
}

/** Serves /rest/v1/* for `page` from `data` (see createAccountData). */
export async function mockSupabaseRest(page, data) {
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    if (method === "OPTIONS") return json(route, 200, {})
    if (data.delayMs) await new Promise((resolve) => setTimeout(resolve, data.delayMs))
    if (data.failAll) return json(route, 500, { message: "mock failure", code: "XX000" })
    const [, , , resource, name] = url.pathname.split("/")
    const id = url.searchParams.get("id")?.replace(/^eq\./, "")
    const body = request.postData() ? JSON.parse(request.postData()) : null
    const wantsRows = (request.headers()["prefer"] ?? "").includes("return=representation")
    if (method !== "GET") data.writes.push({ method, resource: name ? `rpc/${name}` : resource, body })

    if (resource === "rpc" && name === "create_order_request") {
      data.rpcCalls.push(body.request)
      const r = body.request
      const lines = r.items.map((item) => [item.product_ref, item.product_name, item.size || null, item.quantity, item.unit_price])
      const existing = data.orders.find((o) => o.reference === r.reference)
      if (existing) {
        const { order_items, subtotal } = order(r.reference, existing.created_at, lines)
        Object.assign(existing, { order_items, subtotal, customer_name: r.customer_name, city_area: r.city_area })
        return json(route, 200, existing.id)
      }
      const created = order(r.reference, now(), lines, { customer_name: r.customer_name, city_area: r.city_area })
      data.orders.push(created)
      return json(route, 200, created.id)
    }

    if (resource === "profiles") {
      if (method === "GET") return json(route, 200, data.profile ? [data.profile] : [])
      if (method === "PATCH") {
        if (!data.profile) return json(route, 200, [])
        Object.assign(data.profile, body)
        return wantsRows ? json(route, 200, [data.profile]) : json(route, 204)
      }
      if (method === "POST") {
        data.profile = { phone: "", ...body }
        return json(route, 201)
      }
    }

    if (resource === "addresses") {
      const list = data.addresses
      if (method === "GET")
        return json(route, 200, [...list].sort((a, b) => a.created_at.localeCompare(b.created_at)))
      if (method === "POST") {
        if (list.length >= 20) return json(route, 400, { code: "P0001", message: "address_limit_reached" })
        const created = { id: uuid(), user_id: PREVIEW_USER_ID, created_at: now(), ...body }
        if (!list.length) created.is_default = true
        list.push(created)
        settleDefault(list, created)
        return json(route, 201)
      }
      const target = list.find((address) => address.id === id)
      if (method === "PATCH") {
        if (target) {
          const keep = target.is_default && body.is_default === false
          Object.assign(target, body)
          if (keep) target.is_default = true
          settleDefault(list, target)
        }
        return json(route, 204)
      }
      if (method === "DELETE") {
        if (target) list.splice(list.indexOf(target), 1)
        settleDefault(list, null)
        return json(route, 204)
      }
    }

    if (resource === "orders" && method === "GET")
      return json(route, 200, [...data.orders].sort((a, b) => b.created_at.localeCompare(a.created_at)))

    // Anything else the site should never do (e.g. editing an order).
    return json(route, 403, { message: `mock: ${method} ${resource} not allowed`, code: "42501" })
  })
}
