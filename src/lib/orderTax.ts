/**
 * Tax on every order: always zero (owner decision, 2026-11-13). Shown as a
 * row for transparency, recorded on the order request, and never added to
 * any total. server/orders.mjs stores the same value (ORDER_TAX).
 */
export const ORDER_TAX = 0
