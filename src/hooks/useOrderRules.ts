import { useCallback, useEffect, useRef, useState } from "react"
import { fetchOrderRules, type OrderRules } from "@/services/orderRules"

export type OrderRulesState =
  | { status: "loading" }
  | { status: "ready"; rules: OrderRules }
  | { status: "error" }

/*
 * The last rules read in this tab. A page opened right after a read (the
 * bag's Checkout click, then /checkout) reuses them, so both pages judge the
 * bag by the same value; anything older is read again. The server answers
 * from its own 60 s cache, so a fresh read is cheap.
 */
const REUSE_MS = 10000
let last: { rules: OrderRules; at: number } | null = null
let pending: Promise<OrderRules> | null = null

function readRules() {
  pending ??= fetchOrderRules()
    .then((rules) => {
      last = { rules, at: Date.now() }
      return rules
    })
    .finally(() => {
      pending = null
    })
  return pending
}

const recent = (): OrderRulesState =>
  last && Date.now() - last.at < REUSE_MS
    ? { status: "ready", rules: last.rules }
    : { status: "loading" }

/**
 * The merchant's minimum order for the bag and checkout. `refresh()` reads
 * it again (on every Checkout attempt) and resolves to the rules, or null when
 * they cannot be read: then checkout is unavailable, never given a default.
 */
export function useOrderRules() {
  const [state, setState] = useState<OrderRulesState>(recent)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const rules = await readRules()
      if (mounted.current) setState({ status: "ready", rules })
      return rules
    } catch {
      if (mounted.current) setState({ status: "error" })
      return null
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    if (recent().status === "loading") void refresh()
    return () => {
      mounted.current = false
    }
  }, [refresh])

  return { state, refresh }
}
