import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { BUY3_PROMOTION_ID, buy3Promotion } from "../shared/buy3Promotion.mjs"
import { escapeHtml } from "./contact.mjs"

/*
 * Order requests (POST /api/orders). Every commercial field is rebuilt here
 * from the company catalogue (Welp); the browser's names, prices, totals,
 * currency and availability are only compared, never trusted. The order is
 * stored first (Supabase, store_verified_order) and the company email is
 * attempted after, so a mail failure never loses an order.
 */

const WELP_BUSINESS_ID = 84116

/**
 * TEMPORARY BUSINESS ASSUMPTION, same as `currency` in src/config/catalog.ts:
 * the catalogue returns no currency and the shop sells in Egyptian pounds.
 */
export const ORDER_CURRENCY = "EGP"

const SEND_TIMEOUT_MS = 20000

/**
 * Minimum payable product subtotal (EGP: verified sale and option prices,
 * after the Buy 3 promotion, without shipping). Read from shared/orderRules.json, the same file the storefront
 * imports in src/lib/minimumOrder.ts, so the two can never disagree.
 */
export const MINIMUM_ORDER_SUBTOTAL = (() => {
  const { minimumOrderSubtotal: value } = JSON.parse(readFileSync(new URL("../shared/orderRules.json", import.meta.url), "utf8"))
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("shared/orderRules.json: invalid minimumOrderSubtotal")
  return value
})()

/**
 * `code` and `extra` go to the browser; `category` and `detail` only to the
 * server log, which never carries customer details.
 */
export class OrderError extends Error {
  constructor(code, status = 400, extra = {}, category = "invalid_request", detail = {}) {
    super(code)
    Object.assign(this, { code, status, extra, category, detail })
  }
}
const invalid = () => { throw new OrderError("invalid_order") }
const catalogueError = (detail) => new OrderError("catalogue_unavailable", 503, {}, "welp_fetch", detail)
const text = (value, max, required = false) => {
  if (typeof value !== "string" || value.length > max || /[\x00-\x08\x0b-\x1f\x7f]/.test(value)) invalid()
  const result = value.trim()
  if (required && !result) invalid()
  return result
}
const id = (value) => Number.isSafeInteger(value) && value > 0
const cents = (value) => {
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(String(value))) throw catalogueError({ reason: "price" })
  const n = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(n) || n > 100000000) throw catalogueError({ reason: "price" })
  return n
}

// The catalogue names options in Arabic. Same table and folding as
// optionLabel() in src/services/products/adapter.ts; scripts/audit/
// products.test.mjs keeps the two equal.
const fold = (value) =>
  value.trim().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ")
const ENGLISH_OPTION_LABELS = new Map(
  [["بالعلبة", "With box"], ["بدون علبة", "Without box"], ["اختر", "Choose"], ["اختار", "Choose"]]
    .map(([arabic, english]) => [fold(arabic), english]),
)
/** English for a catalogue option label, or the label itself when none is known. */
export const englishOptionLabel = (label) => ENGLISH_OPTION_LABELS.get(fold(label)) ?? label

export async function fetchProduct(productId) {
  let response
  try {
    response = await fetch(`https://api.welpstar.com/api/v1/businesses/${WELP_BUSINESS_ID}/products/${productId}`, {
      headers: { "App-ID": "WEBSITE", "Accept-Language": "EN", Accept: "application/json" },
      redirect: "error", signal: AbortSignal.timeout(20000),
    })
  } catch (error) {
    throw catalogueError({ reason: error?.name === "TimeoutError" ? "timeout" : "network" })
  }
  if (response.status === 404) throw new OrderError("invalid_product", 400, { productId }, "invalid_product", { productId })
  if (!response.ok) throw catalogueError({ upstreamStatus: response.status })
  let data
  try { ({ data } = await response.json()) } catch { throw catalogueError({ reason: "body" }) }
  if (data?.id !== productId) throw new OrderError("invalid_product", 400, { productId }, "invalid_product", { productId })
  return data
}

/**
 * Rebuild all commercial fields. Browser prices are only a comparison, never an authority.
 * `getArabicNames(ids)` returns approved Arabic product names (product_metadata.name_ar)
 * by product id; products without one keep the company's English name in Arabic too.
 */
export async function verifyOrder(input, user, getProduct = fetchProduct, getArabicNames = async () => new Map()) {
  if (!input || !Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 50) invalid()
  if (!/^PF-[A-Z0-9-]{8,36}$/.test(input.reference) || !["en", "ar"].includes(input.locale)) invalid()
  const customer = {
    fullName: text(input.customer?.fullName, 120, true),
    phone: text(input.customer?.phone, 40, true),
    email: text(input.customer?.email, 160, true), userId: user.is_anonymous ? null : user.id,
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(customer.email) || /[\r\n]/.test(customer.email) || !/^\+?[\d ()-]{7,40}$/.test(customer.phone)) invalid()
  const delivery = { address: text(input.delivery?.address, 300, true), cityArea: text(input.delivery?.cityArea, 120, true) }
  const seen = new Set()
  // Fetch each product once, bounded concurrency (not 50 simultaneous upstream requests).
  const products = new Map()
  for (const line of input.lines) {
    if (!id(line?.welpProductId) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10 || !Array.isArray(line.options) || line.options.length > 10) invalid()
    if (!products.has(line.welpProductId)) products.set(line.welpProductId, null)
  }
  const ids = [...products.keys()]
  for (let i = 0; i < ids.length; i += 5) await Promise.all(ids.slice(i, i + 5).map(async (key) => products.set(key, await getProduct(key))))
  const arabicNames = await getArabicNames(ids)
  const lines = input.lines.map((line) => {
    const product = products.get(line.welpProductId)
    if (product?.id !== line.welpProductId) throw new OrderError("invalid_product", 400, {}, "invalid_product", { productId: line.welpProductId })
    if (product.is_available !== true) throw new OrderError("unavailable_product", 409, { productId: product.id, name: product.name, nameAr: arabicNames.get(product.id) ?? product.name }, "unavailable_product", { productId: product.id })
    if (typeof product.name !== "string" || !product.name.trim()) throw catalogueError({ reason: "name", productId: product.id })
    const variations = product.variations ?? []
    if (!Array.isArray(variations) || (product.is_variation_available && !variations.length)) throw catalogueError({ reason: "variations", productId: product.id })
    let price = cents(product.price_after_discount)
    const options = []
    for (const pick of line.options) {
      if (!id(pick?.variationId) || !id(pick.optionId) || options.some((o) => o.variationId === pick.variationId)) throw new OrderError("invalid_option", 400, {}, "invalid_product", { productId: product.id })
      const variation = variations.find((v) => v.id === pick.variationId)
      const option = variation?.options?.find((o) => o.id === pick.optionId)
      if (!option || variation.is_select_multiple || (variation.max_selection ?? 1) !== 1) throw new OrderError("invalid_option", 400, {}, "invalid_product", { productId: product.id })
      if (option.is_available === false) throw new OrderError("unavailable_product", 409, { productId: product.id, name: product.name, nameAr: arabicNames.get(product.id) ?? product.name }, "unavailable_product", { productId: product.id })
      const label = String(option.name).trim()
      options.push({ variationId: variation.id, optionId: option.id, label: englishOptionLabel(label), labelAr: label })
    }
    // Follow catalogue variation order, matching the storefront price semantics.
    for (const variation of variations) {
      const pick = options.find((o) => o.variationId === variation.id)
      if (!pick) { if (variation.is_required) throw new OrderError("option_required", 400, {}, "invalid_product", { productId: product.id }); continue }
      const option = variation.options.find((o) => o.id === pick.optionId)
      price = variation.is_main_price ? cents(option.price_after_discount) : price + cents(option.additional_price ?? 0)
    }
    options.sort((a, b) => a.variationId - b.variationId)
    const productId = [product.id, ...options.map((o) => o.optionId)].join("~")
    if (seen.has(productId)) throw new OrderError("duplicate_line")
    seen.add(productId)
    const english = product.name.trim()
    const arabic = arabicNames.get(product.id) ?? english
    const withOptions = (name, key) => name + (options.length ? ` (${options.map((o) => o[key]).join(", ")})` : "")
    return { productId, welpProductId: product.id, options,
      // `name` is the company's English, the canonical record; `nameAr` is what Arabic pages show.
      name: withOptions(english, "label"), nameAr: withOptions(arabic, "labelAr"),
      size: null, quantity: line.quantity, unitPrice: price / 100, lineTotal: price * line.quantity / 100,
      imageUrl: typeof product.image === "string" && /^https:\/\//.test(product.image) ? product.image : null }
  })
  // Buy 3 — Cheapest Item Free, on the verified prices only. Anything the
  // browser says about a promotion (free items, discounts) is never read.
  const promo = buy3Promotion(lines.map((line) => ({ id: line.productId, unitCents: Math.round(line.unitPrice * 100), quantity: line.quantity })))
  for (const free of promo.freeLines) {
    // The line keeps its real verified price; the free units are recorded beside it.
    Object.assign(lines.find((line) => line.productId === free.id), { freeQuantity: free.freeQuantity, promotionDiscount: free.discountCents / 100 })
  }
  const subtotal = promo.subtotalCents / 100
  const payable = promo.totalCents / 100
  const promotion = promo.freeUnitCount
    ? { id: BUY3_PROMOTION_ID, name: "Buy 3 — Cheapest Item Free", freeUnits: promo.freeUnitCount, discount: promo.discountCents / 100, payableSubtotal: payable }
    : null
  // Checked on what the customer pays (after the promotion) before anything is
  // stored or emailed, and before the price comparison: a bag under the
  // minimum cannot be confirmed either way. `subtotal` here is that payable amount.
  if (promo.totalCents < Math.round(MINIMUM_ORDER_SUBTOTAL * 100)) {
    throw new OrderError("minimum_order_not_met", 422,
      { minimum: MINIMUM_ORDER_SUBTOTAL, subtotal: payable, productSubtotal: subtotal, discount: promotion?.discount ?? 0, currency: ORDER_CURRENCY },
      "minimum_order", { subtotal: payable })
  }
  // `subtotal` stays the verified product subtotal (unit prices x quantities,
  // as orders.subtotal stores it); `displayedTotal` is what the customer pays.
  const order = { reference: input.reference, createdAt: new Date().toISOString(), status: "requested", locale: input.locale,
    customer, delivery, notes: text(input.notes ?? "", 1000) || null, lines, currency: ORDER_CURRENCY, subtotal, promotion, displayedTotal: payable,
    gift: input.gift ? { message: text(input.gift.message, 250) } : null,
    promo: input.promo ? { code: text(input.promo.code, 40), status: "entered-not-applied" } : null,
    shipping: null, tax: null, payment: null }
  const changed = input.currency !== order.currency || input.displayedTotal !== payable || lines.some((line, i) => line.unitPrice !== input.lines[i].unitPrice)
  if (changed) throw new OrderError("price_changed", 409, { order }, "price_changed")
  return order
}

export function orderFingerprint(order) {
  const { createdAt, ...stable } = order
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex")
}

/**
 * The company's email for a stored order, in English for the team. A
 * revision above 1 is an edited resubmit of the same reference.
 */
export function buildOrderEmail(order, mail, revision = order.revision ?? 1) {
  const updated = revision > 1
  const arabic = order.locale === "ar"
  const body = [
    ...(updated ? [`UPDATED ORDER: the customer edited and resubmitted order ${order.reference} (version ${revision}). This replaces the earlier version.`, ""] : []),
    `Reference: ${order.reference}`, `Date: ${order.createdAt}`, `Language: ${arabic ? "Arabic" : "English"}`,
    `Name: ${order.customer.fullName}`, `Email: ${order.customer.email}`, `Phone / customer WhatsApp: ${order.customer.phone}`,
    `Address: ${order.delivery.address}`, `City: ${order.delivery.cityArea}`, "",
    ...order.lines.flatMap((line) => [
      `${line.productId} | ${line.name} | ${line.quantity} x ${line.unitPrice} ${order.currency} = ${line.lineTotal} ${order.currency}`,
      ...(arabic && line.nameAr && line.nameAr !== line.name ? [`   Shown to the customer as: ${line.nameAr}`] : []),
      // The product keeps its real price; the promotion is a discount on the order.
      ...(line.freeQuantity ? [`   Buy 3 promotion: ${line.freeQuantity} of ${line.quantity} free (discount -${line.promotionDiscount} ${order.currency}; catalogue price unchanged)`] : []),
    ]),
    ...(order.promotion
      ? [
        `Products subtotal (verified prices, before promotion): ${order.subtotal} ${order.currency}`,
        `${order.promotion.name} (${order.promotion.freeUnits} free ${order.promotion.freeUnits === 1 ? "unit" : "units"}, cheapest): -${order.promotion.discount} ${order.currency}`,
        `Payable product subtotal / displayed total: ${order.displayedTotal} ${order.currency}`,
      ]
      : [`Subtotal / displayed total: ${order.subtotal} ${order.currency}`]),
    "Shipping and tax: to be confirmed by store; no payment collected.",
    `Notes: ${order.notes ?? ""}`, `Gift: ${order.gift?.message ?? ""}`, `Promo (not applied): ${order.promo?.code ?? ""}`,
  ].join("\n")
  return { from: mail.from, to: mail.to, replyTo: order.customer.email,
    subject: `Perfumira Website – ${updated ? "Updated Order" : "New Order"} – ${order.reference}`,
    text: body, html: `<pre>${escapeHtml(body)}</pre>` }
}

/** SMTP fields that are safe to log (never the message or credentials). */
const smtpDetail = (error) => ({ code: error?.code, responseCode: error?.responseCode, command: error?.command })

export function createOrderHandler({ store, transport, mail, getProduct = fetchProduct, log = () => {} }) {
  return async (req, res) => {
    let reference
    try {
      if (!store) throw new OrderError("unavailable", 503, {}, "configuration")
      const token = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? "")?.[1]
      if (!token) throw new OrderError("session_expired", 401, {}, "authentication")
      const user = await store.authenticate(token)
      if (!user) throw new OrderError("session_expired", 401, {}, "authentication")
      const getArabicNames = async (ids) => {
        try { return (await store.arabicNames?.(ids)) ?? new Map() } catch {
          log("Order Arabic names unavailable", { category: "storage" })
          return new Map()
        }
      }
      const order = await verifyOrder(req.body, user, getProduct, getArabicNames)
      reference = order.reference
      const saved = await store.save(order, user.id, orderFingerprint(order))
      // The database returns the persisted snapshot, including its original timestamp and revision.
      let emailState = saved.notification_status === "sent" ? "success" : "error"
      if (!transport || !mail?.from || !mail?.to) emailState = saved.notification_status === "sent" ? "success" : "unavailable"
      else if (saved.notification_status !== "sent") {
        let claim = null
        try { claim = await store.claimNotification(saved.id) } catch {
          log("Order notification failed", { category: "storage", reference })
        }
        if (claim) {
          let sent = false
          try {
            await withTimeout(transport.sendMail(buildOrderEmail(saved.verified_snapshot, mail, saved.revision)), SEND_TIMEOUT_MS)
            sent = true
          } catch (error) {
            log("Order notification failed", { category: "smtp", reference, ...smtpDetail(error) })
          }
          emailState = sent ? "success" : "error"
          // The order is already stored; a lost outcome leaves a claim that expires.
          try { await store.finishNotification(saved.id, claim, sent ? "sent" : "failed") } catch {
            log("Order notification status not saved", { category: "storage", reference })
          }
        } else if (saved.notification_status === "sending") emailState = "sending"
      }
      return res.json({ ok: true, order: saved.verified_snapshot, emailState, updated: saved.revision > 1 })
    } catch (error) {
      const known = error instanceof OrderError
      log("Order submission failed", known
        ? { category: error.category, code: error.code, ...(reference ? { reference } : {}), ...error.detail }
        : { category: "unexpected", name: error?.name })
      return res.status(known ? error.status : 503).json({ ok: false, error: known ? error.code : "order_unavailable", ...(known ? error.extra : {}) })
    }
  }
}

export function supabaseOrderStore(client) {
  const storage = (error) => new OrderError("storage_unavailable", 503, {}, "storage", { code: error?.code })
  return {
    async authenticate(token) {
      const { data, error } = await client.auth.getUser(token)
      return error ? null : data.user
    },
    async arabicNames(ids) {
      const { data, error } = await client.from("product_metadata").select("product_id, name_ar")
        .eq("business_id", WELP_BUSINESS_ID).in("product_id", ids)
      if (error) throw error
      return new Map(data.filter((row) => typeof row.name_ar === "string" && row.name_ar.trim()).map((row) => [row.product_id, row.name_ar.trim()]))
    },
    async save(order, owner, fingerprint) {
      const { data, error } = await client.rpc("store_verified_order", { request: { owner, fingerprint, snapshot: order } })
      if (error) {
        if (error.message?.includes("order_locked")) throw new OrderError("order_locked", 409, {}, "storage", { code: "order_locked" })
        throw storage(error)
      }
      return data
    },
    async claimNotification(id) {
      const { data, error } = await client.rpc("claim_order_notification", { order_id: id })
      if (error) throw storage(error)
      return data ?? null
    },
    async finishNotification(id, claim, outcome) {
      const { error } = await client.rpc("finish_order_notification", { order_id: id, claim, outcome })
      if (error) throw storage(error)
    },
  }
}

function withTimeout(promise, ms) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}
