// The bag journal's merge rules (src/cart/bagSync.ts).
// usage: node --experimental-strip-types --test scripts/audit/bag-sync.test.mjs
import assert from "node:assert/strict"
import { test } from "node:test"
import { addLines, mergeLines, sameLines } from "../../src/cart/bagSync.ts"

const bag = (spec) =>
  spec ? spec.split(",").map((line) => { const [id, q] = line.split("x"); return { id, quantity: Number(q) } }) : []
const show = (lines) => lines.map((l) => `${l.id}x${l.quantity}`).join(",")
const merge = (saved, base, wanted) => show(mergeLines(bag(saved), bag(base), bag(wanted)))

test("an add that never reached the database is applied", () => {
  assert.equal(merge("", "", "19x1"), "19x1")
  assert.equal(merge("19x1", "19x1", "19x3"), "19x3")
})

test("an add that did reach the database is not applied twice", () => {
  assert.equal(merge("19x1", "", "19x1"), "19x1")
  assert.equal(merge("19x3", "19x1", "19x3"), "19x3")
})

test("part of a run of quick adds saved: the rest is applied once", () => {
  assert.equal(merge("19x2", "19x1", "19x3"), "19x3")
  assert.equal(merge("19x1,23x1", "", "19x3,23x1,25x1"), "19x1,23x1,25x1".replace("19x1", "19x3"))
})

test("removals and lower quantities finish too", () => {
  assert.equal(merge("19x1,23x2", "19x1,23x2", "23x1"), "23x1")
  assert.equal(merge("19x2", "19x2", ""), "")
  assert.equal(merge("", "19x2", ""), "")
})

test("a line changed elsewhere meanwhile keeps the saved quantity", () => {
  assert.equal(merge("19x5", "19x1", "19x2"), "19x5")
  assert.equal(merge("19x1,30x2", "19x1", "19x1"), "19x1,30x2")
})

test("applying the same journal twice changes nothing", () => {
  const once = mergeLines(bag("19x1"), bag("19x1"), bag("19x2,23x1"))
  assert.equal(show(mergeLines(once, bag("19x1"), bag("19x2,23x1"))), show(once))
})

test("visitor lines add on top, capped", () => {
  assert.equal(show(addLines(bag("19x9"), bag("19x3,23x1"), 10)), "19x10,23x1")
  assert.ok(sameLines(bag("19x1,23x2"), bag("23x2,19x1")))
  assert.ok(!sameLines(bag("19x1"), bag("19x2")))
})
