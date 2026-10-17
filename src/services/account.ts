import type { SupabaseClient } from "@supabase/supabase-js"
import { loadSupabase } from "@/lib/supabase"
import type {
  AccountErrorCode,
  AccountResult,
  AddressInput,
  CustomerProfile,
  OrderHistoryEntry,
  SavedAddress,
} from "@/types/account"

/*
 * Account adapter for the customer data Supabase owns: profile, saved
 * addresses and order-request history (supabase/migrations). Every query
 * runs as the signed-in customer with the publishable key; row level
 * security limits it to their own rows, so nothing here filters for
 * security. Results never throw: failures come back as an error code.
 */

interface ProfileRow {
  first_name: string
  last_name: string
  phone: string
}

interface AddressRow {
  id: string
  label: string
  full_name: string
  phone: string
  address: string
  city_area: string
  is_default: boolean
}

interface OrderItemRow {
  position: number
  product_ref: string
  product_name: string
  size: string | null
  quantity: number
  unit_price: number | string
  line_total: number | string
  image_url: string | null
}

interface OrderRow {
  id: string
  reference: string
  created_at: string
  status: "request_created"
  subtotal: number | string
  currency: string
  order_items: OrderItemRow[]
}

interface QueryError {
  message: string
  code?: string
}

const ADDRESS_COLUMNS =
  "id, label, full_name, phone, address, city_area, is_default"

const ORDER_COLUMNS =
  "id, reference, created_at, status, subtotal, currency, order_items(position, product_ref, product_name, size, quantity, unit_price, line_total, image_url)"

const failure = (error: AccountErrorCode) => ({ ok: false as const, error })

/** Runs `action` with the client; "unavailable" when Supabase is not configured. */
async function withClient<T>(
  action: (supabase: SupabaseClient) => Promise<AccountResult<T>>,
): Promise<AccountResult<T>> {
  try {
    const supabase = await loadSupabase()
    if (!supabase) return failure("unavailable")
    return await action(supabase)
  } catch (error) {
    console.error("Account request failed", error)
    return failure("failed")
  }
}

function failed(error: QueryError): AccountResult<never> {
  if (error.message?.includes("address_limit_reached")) {
    return failure("address_limit")
  }
  console.error("Account request failed", error)
  return failure("failed")
}

/** Local calendar date (YYYY-MM-DD) of a timestamp. */
function localDate(timestamp: string) {
  const date = new Date(timestamp)
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-")
}

const toAddress = (row: AddressRow): SavedAddress => ({
  id: row.id,
  label: row.label,
  fullName: row.full_name,
  phone: row.phone,
  address: row.address,
  cityArea: row.city_area,
  isDefault: row.is_default,
})

const addressRow = (input: AddressInput) => ({
  label: input.label.trim(),
  full_name: input.fullName.trim(),
  phone: input.phone.trim(),
  address: input.address.trim(),
  city_area: input.cityArea.trim(),
  is_default: input.isDefault,
})

const toOrder = (row: OrderRow): OrderHistoryEntry => ({
  id: row.id,
  reference: row.reference,
  placedOn: localDate(row.created_at),
  status: row.status,
  subtotal: Number(row.subtotal),
  currency: row.currency,
  items: [...row.order_items]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      position: item.position,
      productRef: item.product_ref,
      name: item.product_name,
      size: item.size,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total),
      imageUrl: item.image_url,
    })),
})

/* Profile */

/** The customer's profile, or null if the row does not exist yet. */
export function getProfile(userId: string) {
  return withClient<CustomerProfile | null>(async (supabase) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", userId)
      .maybeSingle<ProfileRow>()
    if (error) return failed(error)
    return {
      ok: true,
      data: data
        ? {
            firstName: data.first_name,
            lastName: data.last_name,
            phone: data.phone,
          }
        : null,
    }
  })
}

/** Saves names and phone; creates the profile if sign-up did not. */
export function saveProfile(userId: string, profile: CustomerProfile) {
  return withClient<CustomerProfile>(async (supabase) => {
    const values = {
      first_name: profile.firstName.trim(),
      last_name: profile.lastName.trim(),
      phone: profile.phone.trim(),
    }
    const updated = await supabase
      .from("profiles")
      .update(values)
      .eq("id", userId)
      .select("first_name, last_name, phone")
    if (updated.error) return failed(updated.error)
    if (!updated.data.length) {
      const created = await supabase
        .from("profiles")
        .insert({ id: userId, ...values })
      if (created.error) return failed(created.error)
    }
    return {
      ok: true,
      data: {
        firstName: values.first_name,
        lastName: values.last_name,
        phone: values.phone,
      },
    }
  })
}

/* Addresses */

/** Saved addresses, default first, then oldest first. */
export function listAddresses() {
  return withClient<SavedAddress[]>(async (supabase) => {
    const { data, error } = await supabase
      .from("addresses")
      .select(ADDRESS_COLUMNS)
      .order("created_at", { ascending: true })
      .returns<AddressRow[]>()
    if (error) return failed(error)
    const addresses = data.map(toAddress)
    return {
      ok: true,
      data: [
        ...addresses.filter((address) => address.isDefault),
        ...addresses.filter((address) => !address.isDefault),
      ],
    }
  })
}

/*
 * Mutations return nothing: the database keeps one default address (see the
 * addresses migration), which can change other rows, so callers reload the
 * list afterwards.
 */

export function createAddress(input: AddressInput) {
  return withClient<null>(async (supabase) => {
    const { error } = await supabase.from("addresses").insert(addressRow(input))
    return error ? failed(error) : { ok: true, data: null }
  })
}

export function updateAddress(id: string, input: AddressInput) {
  return withClient<null>(async (supabase) => {
    const { error } = await supabase
      .from("addresses")
      .update(addressRow(input))
      .eq("id", id)
    return error ? failed(error) : { ok: true, data: null }
  })
}

export function setDefaultAddress(id: string) {
  return withClient<null>(async (supabase) => {
    const { error } = await supabase
      .from("addresses")
      .update({ is_default: true })
      .eq("id", id)
    return error ? failed(error) : { ok: true, data: null }
  })
}

export function deleteAddress(id: string) {
  return withClient<null>(async (supabase) => {
    const { error } = await supabase.from("addresses").delete().eq("id", id)
    return error ? failed(error) : { ok: true, data: null }
  })
}

/* Order-request history */

/** The customer's order requests, newest first, with their items. */
export function listOrders() {
  return withClient<OrderHistoryEntry[]>(async (supabase) => {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .order("created_at", { ascending: false })
      .returns<OrderRow[]>()
    if (error) return failed(error)
    return { ok: true, data: data.map(toOrder) }
  })
}
