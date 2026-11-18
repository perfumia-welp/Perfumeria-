import assert from "node:assert/strict"
import { test } from "node:test"
import {
  PERFUME_SET_PRODUCT_TYPES,
  displayProductDescription,
  displayProductName,
  perfumeSetDescription,
  perfumeSetName,
} from "./perfumeSetName.mjs"

test("live Perfume Boxes names (Welp, 2026-11-18) become perfume sets", () => {
  for (const [company, display] of [
    ["Billie Eilish Eau de Parfum Gift", "Billie Eilish Eau de Parfum Set"],
    ["Rasasi Hawas Gift Set for Him", "Rasasi Hawas Perfume Set for Him"],
    ["ASSAF Luxury Perfume Gift", "ASSAF Luxury Perfume Set"],
    ["Louis Vuitton Gift Set", "Louis Vuitton Perfume Set"],
    ["Laverne Gift Set", "Laverne Perfume Set"],
    ["Kayali Miniature Gift Set", "Kayali Miniature Perfume Set"],
    ["Yves Saint Laurent Gift Set", "Yves Saint Laurent Perfume Set"],
    // Names without "Gift" are left exactly as they are.
    ["Lattafa Khamrah", "Lattafa Khamrah"],
    ["Ibraq Diamond Collection", "Ibraq Diamond Collection"],
    ["Billie Eilish", "Billie Eilish"],
    ["Louis Vuitton Luxury", "Louis Vuitton Luxury"],
  ])
    assert.equal(perfumeSetName(company), display, company)
})

test("other spellings: case kept, no doubled words", () => {
  assert.equal(perfumeSetName("BLEU DE CHANEL GIFT SET"), "BLEU DE CHANEL PERFUME SET")
  assert.equal(perfumeSetName("Some Perfume Gift Set"), "Some Perfume Set")
  assert.equal(perfumeSetName("Some Fragrance Gift"), "Some Fragrance Set")
  assert.equal(perfumeSetName("Oud Gift  "), "Oud Perfume Set")
  assert.equal(perfumeSetName("Gifted Collection"), "Gifted Collection")
})

test("descriptions: gift set becomes perfume / fragrance set; gift box and gifting stay", () => {
  assert.equal(
    perfumeSetDescription("Billie Eilish Eau de Parfum Gift Set – 100ml + 30ml"),
    "Billie Eilish Eau de Parfum Set – 100ml + 30ml",
  )
  assert.equal(
    perfumeSetDescription("ASSAF Luxury Perfume Gift Set – 6 Fragrances"),
    "ASSAF Luxury Perfume Set – 6 Fragrances",
  )
  assert.equal(
    perfumeSetDescription("this exclusive men's fragrance gift set."),
    "this exclusive men's fragrance set.",
  )
  assert.equal(perfumeSetDescription("Laverne Gift Set – 3 Piece"), "Laverne Perfume Set – 3 Piece")
  assert.equal(perfumeSetDescription("5 Piece Gift Set ✨"), "5 Piece Perfume Set ✨")
  assert.equal(perfumeSetDescription("in one elegant gift set."), "in one elegant perfume set.")
  assert.equal(
    perfumeSetDescription("Presented in an elegant gift box, perfect for gifting someone special."),
    "Presented in an elegant gift box, perfect for gifting someone special.",
  )
})

test("only Perfume Boxes (type 1684) are changed", () => {
  assert.deepEqual([...PERFUME_SET_PRODUCT_TYPES], [1684])
  assert.equal(displayProductName("Laverne Gift Set", 1684), "Laverne Perfume Set")
  for (const type of [1344, 1382, null, undefined]) {
    assert.equal(displayProductName("BLEU DE CHANEL GIFT SET", type), "BLEU DE CHANEL GIFT SET")
    assert.equal(displayProductDescription("a 2-Piece Gift Set", type), "a 2-Piece Gift Set")
  }
})
