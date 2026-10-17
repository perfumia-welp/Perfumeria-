export type Slot = number | "gap"

/**
 * First, last, the current page and `siblings` pages either side of it,
 * with a gap marker where pages are skipped. A gap would never hide a single
 * page, so that page is shown instead: 1 … 8 9 10 … 31, 1 2 3 4 … 31.
 */
export function pageWindow(page: number, count: number, siblings: number): Slot[] {
  const pages = new Set([1, count])
  for (let n = page - siblings; n <= page + siblings; n++)
    if (n >= 1 && n <= count) pages.add(n)
  const slots: Slot[] = []
  let previous = 0
  for (const n of [...pages].sort((a, b) => a - b)) {
    if (n - previous === 2) slots.push(n - 1)
    else if (n - previous > 2) slots.push("gap")
    slots.push(n)
    previous = n
  }
  return slots
}

