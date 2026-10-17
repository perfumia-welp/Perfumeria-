import { useLayoutEffect } from "react"
import { useLocation } from "react-router"

/**
 * The site uses `scroll-behavior: smooth` for in-page anchors. Page changes
 * should not animate, so for navigations without a hash this suspends smooth
 * scrolling while React Router resets or restores the scroll position.
 * Render it immediately before <ScrollRestoration /> so this layout effect
 * runs first.
 */
export default function InstantScrollOnNavigate() {
  const { key, hash } = useLocation()

  useLayoutEffect(() => {
    if (hash) return
    const root = document.documentElement
    root.style.scrollBehavior = "auto"
    // Read it back to force a style recalculation, so the change applies
    // before React Router scrolls in the same frame.
    void getComputedStyle(root).scrollBehavior
    const frame = requestAnimationFrame(() =>
      root.style.removeProperty("scroll-behavior"),
    )
    return () => {
      cancelAnimationFrame(frame)
      root.style.removeProperty("scroll-behavior")
    }
  }, [key, hash])

  return null
}
