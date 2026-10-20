import { useCallback, useEffect, useRef, useState } from "react"
import usePrefersReducedMotion from "@/hooks/usePrefersReducedMotion"

/*
 * TEMPORARY (hero comparison): slide state and gestures for Hero C.
 *
 * The hero never takes over vertical scrolling: the mouse wheel, trackpad and
 * a vertical swipe always scroll the page, natively. (It used to cancel wheel
 * and touch events while the hero sat at the top, turning each gesture into a
 * slide change and then ignoring the wheel for the 1.3 s transition, so the
 * page felt stuck going down and trapped coming back up.)
 *
 * Slides change with the 01 / 02 / 03 steps (and the arrow keys on them) and,
 * on touch screens, a horizontal swipe. Every listener is passive and nothing
 * is cancelled; the stage's `touch-action: pan-y` leaves vertical panning to
 * the browser.
 */

/** Length of one slide transition; HeroPerfume.css uses the same value. */
export const TRANSITION_MS = 1200

/** Minimum horizontal travel, in px, for a swipe to change slide. */
const SWIPE_MIN = 50

/**
 * @param total number of slides
 * @param forward +1 left-to-right, -1 right-to-left: a swipe towards the
 *   start of the line moves to the next slide.
 */
export default function useHeroStage(total: number, forward: 1 | -1 = 1) {
  const reducedMotion = usePrefersReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  /** The slide being left, until the transition has finished. */
  const [previous, setPrevious] = useState<number | null>(null)
  /** False until the visitor first changes slide. */
  const [moved, setMoved] = useState(false)

  // Mirrors of the state above for the native listeners, which outlive renders.
  const activeRef = useRef(0)
  const busy = useRef(false)
  const timer = useRef(0)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const goTo = useCallback(
    (index: number) => {
      if (busy.current || index === activeRef.current) return
      if (index < 0 || index >= total) return
      busy.current = true
      setPrevious(activeRef.current)
      activeRef.current = index
      setActive(index)
      setMoved(true)
      timer.current = window.setTimeout(
        () => {
          busy.current = false
          setPrevious(null)
        },
        reducedMotion ? 0 : TRANSITION_MS + 120,
      )
    },
    [total, reducedMotion],
  )

  // Touch: a clearly horizontal swipe changes slide; vertical ones scroll.
  useEffect(() => {
    const section = sectionRef.current
    if (!section || total < 2) return
    let start: { x: number; y: number } | null = null

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      start = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null
    }
    const onEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      if (!start || !touch) return
      const dx = start.x - touch.clientX
      const dy = start.y - touch.clientY
      start = null
      if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return
      goTo(activeRef.current + Math.sign(dx) * forward)
    }
    const onCancel = () => {
      start = null
    }

    section.addEventListener("touchstart", onStart, { passive: true })
    section.addEventListener("touchend", onEnd, { passive: true })
    section.addEventListener("touchcancel", onCancel, { passive: true })
    return () => {
      section.removeEventListener("touchstart", onStart)
      section.removeEventListener("touchend", onEnd)
      section.removeEventListener("touchcancel", onCancel)
    }
  }, [goTo, total, forward])

  return { active, previous, moved, reducedMotion, sectionRef, goTo }
}
