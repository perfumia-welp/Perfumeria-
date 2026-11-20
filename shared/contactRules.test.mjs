import assert from "node:assert/strict"
import { test } from "node:test"
import { isValidOrderEmail, isValidOrderPhone, normalizeMobile } from "./contactRules.mjs"

test("Egyptian mobiles: valid forms", () => {
  for (const phone of ["01012345678", "01112345678", "01212345678", "01512345678", "010 1234 5678", "010-1234-5678", "(010) 1234-5678",
    " 01012345678 ", "+201012345678", "+20 101 234 5678", "00201012345678", "٠١٠١٢٣٤٥٦٧٨", "۰۱۰۱۲۳۴۵۶۷۸", "٠١٠ ١٢٣٤ ٥٦٧٨"])
    assert.equal(isValidOrderPhone(phone), true, phone)
})

test("Egyptian mobiles: incomplete, too long, letters, wrong prefix", () => {
  for (const phone of ["0101234567", "010123456789", "01012345678abc", "0101234567a", "abc", "", "   ", "01312345678", "02123456789",
    "1012345678", "+2001012345678", "+20101234567", "201012345678", "+44 7700 900123", "٠١٠١٢٣٤٥٦٧", "0101234567٨٩", "++201012345678", null, undefined, 1012345678])
    assert.equal(isValidOrderPhone(phone), false, String(phone))
})

test("normalizeMobile keeps letters so they fail", () => {
  assert.equal(normalizeMobile("٠١٠ ١٢٣٤-٥٦٧٨"), "01012345678")
  assert.equal(normalizeMobile("0101234567a"), "0101234567a")
})

test("emails", () => {
  for (const email of ["name@example.com", "first.last+tag@sub.example.co.uk", " Name@Example.COM ", "a_b-c@x-y.io"])
    assert.equal(isValidOrderEmail(email), true, email)
  for (const email of ["", "name", "name@", "@example.com", "name@example", "name@example.c", "name@@example.com", "name@.com", "name@example..com",
    ".name@example.com", "name.@example.com", "na..me@example.com", "na me@example.com", "name@exa mple.com", "name@-example.com", "name@example.com.",
    "name@example.123", "name@example.com\n", "<a>@example.com", null])
    assert.equal(isValidOrderEmail(email), false, String(email))
})
