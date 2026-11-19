import assert from "node:assert/strict"
import { test } from "node:test"
import { editableView, normPhone, orderChangeLines, orderChanges } from "./orderChanges.mjs"

const order = (patch = {}) => ({
  reference: "PF-TEST-0001", revision: 1, currency: "EGP",
  customer: { fullName: "Nour Hassan", phone: "01012345678", email: "nour@example.com" },
  delivery: { address: "12 Abbas St, floor 3", cityArea: "Nasr City, Cairo" },
  notes: "Ring twice", gift: null, promo: null,
  lines: [
    { productId: "13963", name: "ARMANI PRIVÉ INDIGO TANZANITE", quantity: 1, unitPrice: 810 },
    { productId: "13965", name: "NARCISO RODRIGUEZ NARCISO ROUGE", quantity: 1, unitPrice: 599 },
  ],
  displayedTotal: 1409, promotion: null,
  ...patch,
})
const diff = (a, b) => orderChanges(editableView(a), editableView(b))

test("identical orders: no changes", () => {
  assert.deepEqual(diff(order(), order()), [])
})

test("spacing, Arabic digits, phone punctuation and email case are not changes", () => {
  const same = order({
    customer: { fullName: "  Nour   Hassan ", phone: "0101 234-5678", email: "Nour@Example.com " },
    delivery: { address: "12 Abbas St,  floor 3", cityArea: "Nasr City, Cairo " },
    notes: " Ring  twice",
  })
  assert.deepEqual(diff(order(), same), [])
  assert.equal(normPhone("٠١٠١٢٣٤٥٦٧٨"), "01012345678")
  assert.deepEqual(diff(order(), order({ customer: { ...order().customer, phone: "٠١٠١٢٣٤٥٦٧٨" } })), [])
})

test("detail changes: old -> new, in a fixed order", () => {
  const changes = diff(order(), order({
    customer: { fullName: "Nour Hassan", phone: "01198765432", email: "nour@example.com" },
    delivery: { address: "5 Makram Ebeid", cityArea: "Nasr City, Cairo" },
    notes: "",
  }))
  assert.deepEqual(changes.map((c) => c.field), ["phone", "address", "notes"])
  const lines = orderChangeLines(changes, "EGP")
  assert.deepEqual(lines, [
    `- Phone: "01012345678" → "01198765432"`,
    `- Street address: "12 Abbas St, floor 3" → "5 Makram Ebeid"`,
    `- Order note: "Ring twice" → (empty)`,
  ])
})

test("products: quantity, removed, added, with display names; totals follow", () => {
  const after = order({
    lines: [
      { productId: "13963", name: "ARMANI PRIVÉ INDIGO TANZANITE", quantity: 2, unitPrice: 810 },
      { productId: "14133", name: "Yves Saint Laurent Gift Set", displayName: "Yves Saint Laurent Perfume Set", quantity: 1, unitPrice: 899 },
    ],
    displayedTotal: 2519,
  })
  const lines = orderChangeLines(diff(order(), after), "EGP")
  assert.deepEqual(lines, [
    "- Product removed: NARCISO RODRIGUEZ NARCISO ROUGE (quantity 1)",
    "- Product added: Yves Saint Laurent Perfume Set (quantity 1)",
    "- Quantity, ARMANI PRIVÉ INDIGO TANZANITE: 1 → 2",
    "- Total: 1409 EGP → 2519 EGP",
  ])
})

test("promotion discount and catalogue price changes are listed", () => {
  const before = order({ lines: [{ productId: "a", name: "A", quantity: 4, unitPrice: 500 }], displayedTotal: 1500, promotion: { discount: 500 } })
  const after = order({ lines: [{ productId: "a", name: "A", quantity: 3, unitPrice: 450 }], displayedTotal: 1350, promotion: null })
  assert.deepEqual(orderChangeLines(diff(before, after), "EGP"), [
    "- Quantity, A: 4 → 3",
    "- Unit price, A: 500 EGP → 450 EGP (current catalogue price)",
    "- Buy 3, Get the 4th Free discount: 500 EGP → 0 EGP",
    "- Total: 1500 EGP → 1350 EGP",
  ])
})

test("a total that moved with no customer change is not reported alone", () => {
  assert.deepEqual(diff(order(), order({ displayedTotal: 1500 })), [])
})

test("gift and promo code", () => {
  const changes = diff(order(), order({ gift: { message: "Happy birthday" }, promo: { code: "vip10" } }))
  assert.deepEqual(orderChangeLines(changes, "EGP"), [
    `- Gift message: (empty) → "Happy birthday"`,
    `- Promo code: (empty) → "vip10"`,
  ])
  assert.deepEqual(diff(order({ promo: { code: "VIP10" } }), order({ promo: { code: "vip10 " } })), [])
})

test("missing versions give no changes (first request, legacy rows)", () => {
  assert.deepEqual(orderChanges(null, editableView(order())), [])
  assert.equal(editableView(null), null)
})
