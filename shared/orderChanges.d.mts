/* Types for shared/orderChanges.mjs (the storefront imports it from TypeScript). */

export interface EditableLine {
  productId: string
  name: string
  quantity: number
  unitPrice: number
}

export interface EditableView {
  revision: number
  customer: { fullName: string; phone: string; email: string }
  delivery: { address: string; cityArea: string }
  notes: string
  gift: { message: string } | null
  promoCode: string
  lines: EditableLine[]
  currency?: string
  displayedTotal?: number
  discount: number
}

export type OrderChange =
  | { kind: "field"; field: string; label: string; from: string; to: string }
  | { kind: "removed" | "added"; productId: string; name: string; quantity: number }
  | { kind: "quantity" | "price"; productId: string; name: string; from: number; to: number }
  | { kind: "discount" | "total"; from: number; to: number }

export declare function normText(value: unknown): string
export declare function normPhone(value: unknown): string
export declare function normEmail(value: unknown): string
export declare function editableView(order: unknown): EditableView | null
export declare function orderChanges(
  before: EditableView | null,
  after: EditableView | null,
): OrderChange[]
export declare function orderChangeLines(
  changes: OrderChange[],
  currency: string,
): string[]
