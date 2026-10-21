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
 *
 * Autoplay: the next slide (looping) every AUTOPLAY_MS after the last change,
 * so a manual change restarts the wait. It holds while a mouse is over the
 * hero, while keyboard focus is inside it, while a finger is on it, while
 * less than a third of it is on screen and while the tab is hidden; it never
 * runs under reduced motion. Automatic changes are not announced to screen
 * readers (only the visitor's own are). All slides' images are already in the
 * page, so autoplay starts no new downloads. The visible Pause / Play control
 * (`paused`, `togglePaused`) stops it until the visitor plays it again.
 */

/** Length of one slide transition; HeroPerfume.css uses the same value. */
export const TRANSITION_MS = 1200

/** Time on each slide before autoplay moves on (includes the transition). */
export const AUTOPLAY_MS = 5500

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
  /** True when the last change was the visitor's own (announced), not autoplay. */
  const [moved, setMoved] = useState(false)
  /** Set by the Pause / Play control; autoplay stays off until played again. */
  const [paused, setPaused] = useState(false)
  const togglePaused = useCallback(() => setPaused((value) => !value), [])
  /** Reasons autoplay is holding: hover, keyboard focus, touch, off screen, hidden tab. */
  const [holds, setHolds] = useState<ReadonlySet<string>>(() => new Set())

  // Mirrors of the state above for the native listeners, which outlive renders.
  const activeRef = useRef(0)
  const busy = useRef(false)
  const timer = useRef(0)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const goTo = useCallback(
    (index: number, auto = false) => {
      if (busy.current || index === activeRef.current) return
      if (index < 0 || index >= total) return
      busy.current = true
      setPrevious(activeRef.current)
      activeRef.current = index
      setActive(index)
      setMoved(!auto)
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

  // Autoplay holds (see the comment at the top).
  useEffect(() => {
    const section = sectionRef.current
    if (!section || reducedMotion || total < 2) return
    const hold = (reason: string, on: boolean) =>
      setHolds((current) => {
        if (current.has(reason) === on) return current
        const next = new Set(current)
        if (on) next.add(reason)
        else next.delete(reason)
        return next
      })
    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hold("hover", true)
    }
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hold("hover", false)
    }
    // Keyboard focus only: a mouse click on a step does not hold autoplay.
    const onFocusIn = (event: FocusEvent) =>
      hold("focus", (event.target as Element).matches(":focus-visible"))
    const onFocusOut = (event: FocusEvent) => {
      if (!section.contains(event.relatedTarget as Node | null)) hold("focus", false)
    }
    const onTouchStart = () => hold("touch", true)
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length === 0) hold("touch", false)
    }
    const onVisibility = () => hold("hidden", document.hidden)
    const observer = new IntersectionObserver(
      ([entry]) => hold("offscreen", entry.intersectionRatio < 0.34),
      { threshold: [0, 0.34, 1] },
    )
    observer.observe(section)
    onVisibility()
    section.addEventListener("pointerenter", onEnter)
    section.addEventListener("pointerleave", onLeave)
    section.addEventListener("focusin", onFocusIn)
    section.addEventListener("focusout", onFocusOut)
    section.addEventListener("touchstart", onTouchStart, { passive: true })
    section.addEventListener("touchend", onTouchEnd, { passive: true })
    section.addEventListener("touchcancel", onTouchEnd, { passive: true })
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      observer.disconnect()
      section.removeEventListener("pointerenter", onEnter)
      section.removeEventListener("pointerleave", onLeave)
      section.removeEventListener("focusin", onFocusIn)
      section.removeEventListener("focusout", onFocusOut)
      section.removeEventListener("touchstart", onTouchStart)
      section.removeEventListener("touchend", onTouchEnd)
      section.removeEventListener("touchcancel", onTouchEnd)
      document.removeEventListener("visibilitychange", onVisibility)
      setHolds(new Set())
    }
  }, [reducedMotion, total])

  // The wait restarts on every change of slide and whenever a hold ends.
  const playing = !reducedMotion && total > 1 && !paused && holds.size === 0
  useEffect(() => {
    if (!playing) return
    const next = window.setTimeout(
      () => goTo((activeRef.current + 1) % total, true),
      AUTOPLAY_MS,
    )
    return () => window.clearTimeout(next)
  }, [playing, active, goTo, total])

  return {
    active,
    previous,
    moved,
    reducedMotion,
    sectionRef,
    goTo,
    paused,
    togglePaused,
  }
}
