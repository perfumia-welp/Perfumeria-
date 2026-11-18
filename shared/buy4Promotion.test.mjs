import assert from "node:assert/strict"
import { test } from "node:test"
import { BUY4_GROUP_SIZE, BUY4_PROMOTION_ID, buy4Promotion } from "./buy4Promotion.mjs"

// Prices in EGP; the rule works in cents.
const line = (id, egp, quantity = 1) => ({ id, unitCents: Math.round(egp * 100), quantity })
const free = (result) => Object.fromEntries(result.freeLines.map((l) => [l.id, l.freeQuantity]))
const egp = (cents) => cents / 100

test("the promotion is Buy 3, Get the 4th Free: groups of four, new id", () => {
  assert.equal(BUY4_GROUP_SIZE, 4)
  assert.equal(BUY4_PROMOTION_ID, "buy4-cheapest-free")
})

test("1-3 units: nothing free; the progress count says how many to add", () => {
  for (const [lines, toNext] of [
    [[line("a", 599)], 3],
    [[line("a", 599), line("b", 710)], 2],
    [[line("a", 599, 2)], 2],
    [[line("a", 599), line("b", 710), line("c", 750)], 1],
    [[line("a", 599, 3)], 1],
    [[line("a", 599, 2), line("b", 710)], 1],
  ]) {
    const r = buy4Promotion(lines)
    assert.equal(r.freeUnitCount, 0)
    assert.equal(r.discountCents, 0)
    assert.equal(r.totalCents, r.subtotalCents)
    assert.deepEqual(r.freeLines, [])
    assert.equal(r.unitsToNextFree, toNext)
  }
  assert.equal(buy4Promotion([]).totalCents, 0)
})

test("the old Buy 3 trigger is gone: 3 eligible items never get a free unit", () => {
  const r = buy4Promotion([line("B", 710), line("A", 599), line("C", 750)])
  assert.equal(egp(r.subtotalCents), 2059)
  assert.equal(r.discountCents, 0)
  assert.equal(egp(r.totalCents), 2059)
})

test("4 mixed prices: 599 + 710 + 750 + 900 = 2,959, cheapest (599) free = 2,360", () => {
  const r = buy4Promotion([line("B", 710), line("D", 900), line("A", 599), line("C", 750)])
  assert.equal(egp(r.subtotalCents), 2959)
  assert.equal(egp(r.discountCents), 599)
  assert.equal(egp(r.totalCents), 2360)
  assert.deepEqual(free(r), { A: 1 })
  assert.equal(r.unitsToNextFree, 4)
})

test("4 of the same unit: one of them free", () => {
  const r = buy4Promotion([line("A", 710, 4)])
  assert.deepEqual(free(r), { A: 1 })
  assert.equal(egp(r.totalCents), 2130)
})

test("free units by unit count: 1-3 -> 0, 4-7 -> 1, 8-11 -> 2, 12 -> 3", () => {
  for (const [units, freeUnits] of [[1, 0], [2, 0], [3, 0], [4, 1], [5, 1], [6, 1], [7, 1], [8, 2], [9, 2], [11, 2], [12, 3]]) {
    const r = buy4Promotion([line("A", 500, units)])
    assert.equal(r.freeUnitCount, freeUnits, `${units} units`)
    assert.equal(r.freeUnitCount, Math.floor(units / BUY4_GROUP_SIZE))
    assert.equal(egp(r.discountCents), 500 * freeUnits)
  }
})

test("5 and 7 different items: still one free, the cheapest", () => {
  const five = buy4Promotion([line("a", 900), line("b", 750), line("c", 599), line("d", 1100), line("e", 710)])
  assert.deepEqual(free(five), { c: 1 })
  assert.equal(egp(five.discountCents), 599)
  assert.equal(five.unitsToNextFree, 3)
  const seven = buy4Promotion([...["a", "b", "c", "d", "e", "f"].map((id, i) => line(id, 800 + i * 50)), line("g", 640)])
  assert.equal(seven.freeUnitCount, 1)
  assert.deepEqual(free(seven), { g: 1 })
  assert.equal(seven.unitsToNextFree, 1)
})

test("8 items: two free, the two cheapest units", () => {
  const r = buy4Promotion([line("a", 900), line("b", 750), line("c", 599), line("d", 1100), line("e", 710), line("f", 1250), line("g", 640), line("h", 820)])
  assert.equal(r.freeUnitCount, 2)
  assert.deepEqual(free(r), { c: 1, g: 1 })
  assert.equal(egp(r.discountCents), 599 + 640)
})

test("quantities count as units, not lines", () => {
  // A x3 + B x1 = 4 units: the cheaper (A) is free once.
  assert.deepEqual(free(buy4Promotion([line("A", 599, 3), line("B", 710, 1)])), { A: 1 })
  // A x2 + B x1 = 3 units: nothing (the old rule made A free here).
  assert.deepEqual(free(buy4Promotion([line("A", 599, 2), line("B", 710, 1)])), {})
  // A x5 + B x3 = 8 units: two cheapest units, both A.
  const r = buy4Promotion([line("A", 599, 5), line("B", 710, 3)])
  assert.deepEqual(free(r), { A: 2 })
  assert.equal(egp(r.discountCents), 1198)
  // Cheapest x1 + others, 8 units: the second free unit is the next cheapest.
  assert.deepEqual(free(buy4Promotion([line("C", 900, 5), line("A", 599, 1), line("B", 710, 2)])), { A: 1, B: 1 })
})

test("sale prices count as they are paid: the price after the sale ranks the units", () => {
  // A sale product (was 1,100, now 599) is cheaper than a regular 650 product.
  const r = buy4Promotion([line("regular", 650), line("sale", 599), line("x", 900), line("y", 950)])
  assert.deepEqual(free(r), { sale: 1 })
  assert.equal(egp(r.discountCents), 599)
})

test("ties: same price picks by line id, whatever the bag order", () => {
  const forward = buy4Promotion([line("14113~12300", 700), line("14074~12221", 700), line("x", 900), line("y", 950)])
  const reverse = buy4Promotion([line("y", 950), line("x", 900), line("14074~12221", 700), line("14113~12300", 700)])
  assert.deepEqual(free(forward), { "14074~12221": 1 })
  assert.deepEqual(free(reverse), free(forward))
  assert.equal(forward.totalCents, reverse.totalCents)
})

test("every bag order gives the same result", () => {
  const lines = [line("a", 599, 2), line("b", 599, 1), line("c", 710, 2), line("d", 1100, 2), line("e", 450.5, 1)]
  const reference = buy4Promotion(lines)
  const permute = (items) => items.length <= 1 ? [items] : items.flatMap((x, i) => permute([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [x, ...p]))
  for (const order of permute(lines)) {
    const r = buy4Promotion(order)
    assert.equal(r.discountCents, reference.discountCents)
    assert.deepEqual(free(r), free(reference))
  }
  // 8 units -> 2 free: 450.50 and one 599 ("a" before "b").
  assert.deepEqual(free(reference), { a: 1, e: 1 })
  assert.equal(egp(reference.discountCents), 1049.5)
})

test("cents are exact (no float drift)", () => {
  const r = buy4Promotion([line("a", 0.1, 4), line("b", 0.2, 4)])
  assert.equal(r.discountCents, 20)
  assert.equal(r.totalCents, 100)
})

test("invalid lines are refused", () => {
  for (const bad of [[{ id: "", unitCents: 1, quantity: 1 }], [{ id: "a", unitCents: 1.5, quantity: 1 }], [{ id: "a", unitCents: -1, quantity: 1 }], [{ id: "a", unitCents: 1, quantity: 0 }], [null]])
    assert.throws(() => buy4Promotion(bad), TypeError)
  assert.throws(() => buy4Promotion("x"), TypeError)
})
