/*
 * Order contact rules, one definition for the checkout form, the order edit
 * form and POST /api/orders (which applies them itself and never trusts the
 * browser). Owner decision 2026-11-20: an order's phone must be a complete
 * Egyptian mobile number.
 */

const ARABIC_DIGITS = /[\u0660-\u0669\u06f0-\u06f9]/g

/** Arabic-Indic (U+0660-0669) and Persian (U+06F0-06F9) digits as 0-9. */
export const asciiDigits = (value) =>
  String(value).replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) - 0x0660) % 0x90))

/**
 * The number as dialled: ASCII digits with spaces, dashes, dots and
 * brackets removed (a leading + kept). Anything else (letters) stays, so it
 * fails the check below.
 */
export const normalizeMobile = (value) =>
  typeof value === "string" ? asciiDigits(value).trim().replace(/[\s\-().\u00a0]/g, "") : ""

/**
 * An Egyptian mobile: 01 + 0/1/2/5 + 8 digits (01012345678), or the same
 * in international form without its leading 0 (+201012345678, 00201012345678).
 */
const EGYPT_MOBILE = /^(?:0|\+20|0020)1[0125]\d{8}$/

export const isValidOrderPhone = (value) => EGYPT_MOBILE.test(normalizeMobile(value))

/**
 * A complete address: a local part without spaces or a leading, trailing or
 * double dot, then a domain of dot-separated labels ending in a letter TLD
 * of 2+ characters ("name@example" and "name@example.c" are refused).
 */
const EMAIL =
  /^(?!\.)(?!.*\.\.)[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}(?<!\.)@(?=.{4,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/

export const isValidOrderEmail = (value) =>
  typeof value === "string" && !/[\r\n]/.test(value) && EMAIL.test(value.trim())
