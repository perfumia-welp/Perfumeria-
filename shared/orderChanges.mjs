/*
 * What changed between two versions of one order request.
 *
 * The server (server/orders.mjs) runs it on the version the team last
 * received by email (kept in the stored snapshot as `lastSent`) and the
 * newly verified order, both from its own records, so a browser cannot
 * claim changes it did not make. The storefront runs the same comparison
 * (sameEditableOrder) to decide whether an edit has anything to save.
 *
 * Effective values only: surrounding and repeated spaces, Arabic-Indic
 * digits, phone punctuation and email letter case never count as a change.
 */

const ARABIC_DIGITS = /[٠-٩۰-۹]/g
const asciiDigits = (value) =>
  value.replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) - 0x0660) % 0x90))

/** Text as it takes effect: trimmed, inner whitespace collapsed. */
export const normText = (value) =>
  typeof value === "string" ? asciiDigits(value).replace(/\s+/g, " ").trim() : ""
/** Phone as dialled: digits (and a leading +) only. */
export const normPhone = (value) => {
  const text = normText(value)
  return (text.startsWith("+") ? "+" : "") + text.replace(/\D/g, "")
}
export const normEmail = (value) => normText(value).toLowerCase()

/**
 * The parts of an order a customer can change, plus what they pay, in the
 * compact form kept as `lastSent` (snapshot fields; tolerant of old orders).
 */
export function editableView(order) {
  if (!order || typeof order !== "object") return null
  return {
    revision: Number.isInteger(order.revision) ? order.revision : 1,
    customer: {
      fullName: normText(order.customer?.fullName),
      phone: normText(order.customer?.phone),
      email: normText(order.customer?.email),
    },
    delivery: {
      address: normText(order.delivery?.address),
      cityArea: normText(order.delivery?.cityArea),
    },
    notes: normText(order.notes ?? ""),
    gift: order.gift ? { message: normText(order.gift.message ?? "") } : null,
    promoCode: normText(order.promo?.code ?? ""),
    lines: (Array.isArray(order.lines) ? order.lines : []).map((line) => ({
      productId: String(line.productId),
      name: normText(line.displayName || line.name),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    currency: order.currency,
    displayedTotal: order.displayedTotal,
    discount: order.promotion?.discount ?? 0,
  }
}

const FIELDS = [
  ["fullName", "Name", (v) => v.customer.fullName, normText],
  ["phone", "Phone", (v) => v.customer.phone, normPhone],
  ["email", "Email", (v) => v.customer.email, normEmail],
  ["cityArea", "City / Area", (v) => v.delivery.cityArea, normText],
  ["address", "Street address", (v) => v.delivery.address, normText],
  ["notes", "Order note", (v) => v.notes, normText],
  ["gift", "Gift message", (v) => (v.gift ? v.gift.message || "(gift, no message)" : ""), normText],
  ["promoCode", "Promo code", (v) => v.promoCode, (s) => normText(s).toUpperCase()],
]

/**
 * Changes from `before` to `after` (editable views), in a fixed order:
 * details, then products (removed, added, quantity, price), then totals.
 * Empty when nothing effective changed.
 */
export function orderChanges(before, after) {
  if (!before || !after) return []
  const changes = []
  for (const [field, label, get, norm] of FIELDS) {
    const [from, to] = [get(before), get(after)]
    if (norm(from) !== norm(to)) changes.push({ kind: "field", field, label, from, to })
  }
  const old = new Map(before.lines.map((l) => [l.productId, l]))
  const now = new Map(after.lines.map((l) => [l.productId, l]))
  for (const [id, line] of old) if (!now.has(id)) changes.push({ kind: "removed", productId: id, name: line.name, quantity: line.quantity })
  for (const [id, line] of now) if (!old.has(id)) changes.push({ kind: "added", productId: id, name: line.name, quantity: line.quantity })
  for (const [id, line] of now) {
    const was = old.get(id)
    if (!was) continue
    if (was.quantity !== line.quantity) changes.push({ kind: "quantity", productId: id, name: line.name, from: was.quantity, to: line.quantity })
    if (was.unitPrice !== line.unitPrice) changes.push({ kind: "price", productId: id, name: line.name, from: was.unitPrice, to: line.unitPrice })
  }
  // Totals move with the products; listed only beside a real change.
  if (changes.length) {
    if (before.discount !== after.discount) changes.push({ kind: "discount", from: before.discount, to: after.discount })
    if (before.displayedTotal !== after.displayedTotal) changes.push({ kind: "total", from: before.displayedTotal, to: after.displayedTotal })
  }
  return changes
}

const shown = (value) => (value === "" || value === null || value === undefined ? "(empty)" : `"${value}"`)

/** The changes as plain-text email lines. */
export function orderChangeLines(changes, currency) {
  const money = (amount) => `${amount} ${currency}`
  return changes.map((c) => {
    switch (c.kind) {
      case "field": return `- ${c.label}: ${shown(c.from)} → ${shown(c.to)}`
      case "removed": return `- Product removed: ${c.name} (quantity ${c.quantity})`
      case "added": return `- Product added: ${c.name} (quantity ${c.quantity})`
      case "quantity": return `- Quantity, ${c.name}: ${c.from} → ${c.to}`
      case "price": return `- Unit price, ${c.name}: ${money(c.from)} → ${money(c.to)} (current catalogue price)`
      case "discount": return `- Buy 3, Get the 4th Free discount: ${money(c.from)} → ${money(c.to)}`
      case "total": return `- Total: ${money(c.from)} → ${money(c.to)}`
      default: return ""
    }
  })
}
