import assert from "node:assert/strict"
import { test } from "node:test"
import { BUY3_GROUP_SIZE, buy3Promotion } from "./buy3Promotion.mjs"

// Prices in EGP; the rule works in cents.
const line = (id, egp, quantity = 1) => ({ id, unitCents: Math.round(egp * 100), quantity })
const free = (result) => Object.fromEntries(result.freeLines.map((l) => [l.id, l.freeQuantity]))
const egp = (cents) => cents / 100

test("1-2 units: nothing free; the progress count says how many to add", () => {
  for (const [lines, toNext] of [[[line("a", 599)], 2], [[line("a", 599), line("b", 710)], 1], [[line("a", 599, 2)], 1]]) {
    const r = buy3Promotion(lines)
    assert.equal(r.freeUnitCount, 0)
    assert.equal(r.discountCents, 0)
    assert.equal(r.totalCents, r.subtotalCents)
    assert.deepEqual(r.freeLines, [])
    assert.equal(r.unitsToNextFree, toNext)
  }
  assert.equal(buy3Promotion([]).totalCents, 0)
})

test("the owner's example: 599 + 710 + 750 = 2,059, minus 599 = 1,460", () => {
  const r = buy3Promotion([line("B", 710), line("A", 599), line("C", 750)])
  assert.equal(egp(r.subtotalCents), 2059)
  assert.equal(egp(r.discountCents), 599)
  assert.equal(egp(r.totalCents), 1460)
  assert.deepEqual(free(r), { A: 1 })
})

test("3 of the same unit: one of them free", () => {
  const r = buy3Promotion([line("A", 710, 3)])
  assert.deepEqual(free(r), { A: 1 })
  assert.equal(egp(r.totalCents), 1420)
})

test("free units by unit count: 3-5 -> 1, 6-8 -> 2, 9 -> 3, 10 -> 3", () => {
  for (const [units, freeUnits] of [[3, 1], [4, 1], [5, 1], [6, 2], [7, 2], [8, 2], [9, 3], [10, 3]]) {
    const r = buy3Promotion([line("A", 500, units)])
    assert.equal(r.freeUnitCount, freeUnits, `${units} units`)
    assert.equal(r.freeUnitCount, Math.floor(units / BUY3_GROUP_SIZE))
    assert.equal(egp(r.discountCents), 500 * freeUnits)
  }
})

test("quantities count as units, not lines", () => {
  // A x2 + B x1 = 3 units: the cheaper (A) is free once.
  assert.deepEqual(free(buy3Promotion([line("A", 599, 2), line("B", 710, 1)])), { A: 1 })
  // A x4 + B x2 = 6 units: two cheapest units, both A.
  const r = buy3Promotion([line("A", 599, 4), line("B", 710, 2)])
  assert.deepEqual(free(r), { A: 2 })
  assert.equal(egp(r.discountCents), 1198)
  // Cheapest x1 + others: the second free unit is the next cheapest.
  assert.deepEqual(free(buy3Promotion([line("C", 900, 3), line("A", 599, 1), line("B", 710, 2)])), { A: 1, B: 1 })
})

test("ties: same price picks by line id, whatever the bag order", () => {
  const forward = buy3Promotion([line("14113~12300", 700), line("14074~12221", 700), line("x", 900)])
  const reverse = buy3Promotion([line("x", 900), line("14074~12221", 700), line("14113~12300", 700)])
  assert.deepEqual(free(forward), { "14074~12221": 1 })
  assert.deepEqual(free(reverse), free(forward))
  assert.equal(forward.totalCents, reverse.totalCents)
})

test("every bag order gives the same result", () => {
  const lines = [line("a", 599, 2), line("b", 599, 1), line("c", 710, 2), line("d", 1100, 1), line("e", 450.5, 1)]
  const reference = buy3Promotion(lines)
  const permute = (items) => items.length <= 1 ? [items] : items.flatMap((x, i) => permute([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [x, ...p]))
  for (const order of permute(lines)) {
    const r = buy3Promotion(order)
    assert.equal(r.discountCents, reference.discountCents)
    assert.deepEqual(free(r), free(reference))
  }
  // 7 units -> 2 free: 450.50 and one 599 ("a" before "b").
  assert.deepEqual(free(reference), { a: 1, e: 1 })
  assert.equal(egp(reference.discountCents), 1049.5)
})

test("cents are exact (no float drift)", () => {
  const r = buy3Promotion([line("a", 0.1, 3), line("b", 0.2, 3)])
  assert.equal(r.discountCents, 20)
  assert.equal(r.totalCents, 70)
})

test("invalid lines are refused", () => {
  for (const bad of [[{ id: "", unitCents: 1, quantity: 1 }], [{ id: "a", unitCents: 1.5, quantity: 1 }], [{ id: "a", unitCents: -1, quantity: 1 }], [{ id: "a", unitCents: 1, quantity: 0 }], [null]])
    assert.throws(() => buy3Promotion(bad), TypeError)
  assert.throws(() => buy3Promotion("x"), TypeError)
})
