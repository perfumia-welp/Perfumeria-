import { useCallback, useEffect, useRef, useState } from "react"
import usePrefersReducedMotion from "@/hooks/usePrefersReducedMotion"

/*
 * TEMPORARY (hero comparison): scroll-stepped slides for Hero C.
 *
 * Adapted from the Crystal Asfour hero. The hero fills the viewport below the
 * header; while it sits at the top of the page ("staged"), a wheel or swipe
 * gesture is taken over and changes one slide instead of scrolling. On the
 * last slide (or on the first, going up) the gesture is left alone, so the
 * page scrolls on as usual. Nothing is sticky and no scroll distance is added.
 *
 * Differences from Crystal Asfour: the stage never unlocks for good, so
 * scrolling back up to the top steps back through the slides, and one gesture
 * moves one slide (the tail of a trackpad swipe cannot skip a slide or leak
 * into the page).
 */

/** Length of one slide transition; HeroPerfume.css uses the same value. */
export const TRANSITION_MS = 1200

/** A pause this long between wheel events starts a new gesture. */
const GESTURE_GAP_MS = 160
/** Smallest wheel movement, in px, that can change slide. */
const WHEEL_MIN = 8
/** A wheel event this large is a deliberate mouse-wheel notch, not a swipe's tail. */
const WHEEL_NOTCH = 50
/** Minimum vertical travel, in px, for a touch swipe to change slide. */
const SWIPE_MIN = 50

/** True while the hero sits at its resting place directly under the header. */
function isStaged(section: HTMLElement) {
  const header = parseFloat(
    getComputedStyle(section).getPropertyValue("--header-height"),
  )
  return section.getBoundingClientRect().top >= (header || 0) - 2
}

interface TouchStart {
  x: number
  y: number
  staged: boolean
}

export default function useHeroStage(total: number) {
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

  // Wheel and trackpad. Under reduced motion the page is never taken over.
  useEffect(() => {
    const section = sectionRef.current
    if (!section || reducedMotion || total < 2) return
    let lastTime = 0
    let lastSize = 0
    let lastDirection = 0
    /** The current gesture belongs to the page, not to the slides. */
    let passing = false

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return
      }
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? window.innerHeight
            : 1
      const size = Math.abs(event.deltaY) * unit
      const direction = Math.sign(event.deltaY)
      // New gesture: after a pause, on a change of direction, or when speeding up.
      const fresh =
        event.timeStamp - lastTime > GESTURE_GAP_MS ||
        direction !== lastDirection ||
        size > lastSize * 1.5 + 4
      lastTime = event.timeStamp
      lastSize = size
      lastDirection = direction

      if (!isStaged(section)) {
        passing = true
        return
      }
      if (fresh) passing = false
      if (passing) return

      if (busy.current) {
        event.preventDefault()
        return
      }
      const target = activeRef.current + direction
      const intended = fresh || size >= WHEEL_NOTCH
      if (target < 0 || target >= total) {
        // Past the first or last slide: hand the gesture to the page.
        if (intended) passing = true
        else event.preventDefault()
        return
      }
      event.preventDefault()
      if (intended && size >= WHEEL_MIN) goTo(target)
    }

    section.addEventListener("wheel", onWheel, { passive: false })
    return () => section.removeEventListener("wheel", onWheel)
  }, [goTo, reducedMotion, total])

  // Touch: a vertical swipe on the staged hero changes slide.
  useEffect(() => {
    const section = sectionRef.current
    if (!section || reducedMotion || total < 2) return
    let start: TouchStart | null = null

    const travel = (touch: Touch) =>
      start ? { x: start.x - touch.clientX, y: start.y - touch.clientY } : null

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      start =
        event.touches.length === 1
          ? { x: touch.clientX, y: touch.clientY, staged: isStaged(section) }
          : null
    }
    const onMove = (event: TouchEvent) => {
      const moved = travel(event.touches[0])
      if (!start?.staged || !moved || event.touches.length !== 1) return
      if (Math.abs(moved.y) <= Math.abs(moved.x)) return
      const target = activeRef.current + Math.sign(moved.y)
      const hasSlide = target >= 0 && target < total
      // Hold the page still while there is a slide to move to.
      if ((busy.current || hasSlide) && event.cancelable) event.preventDefault()
    }
    const onEnd = (event: TouchEvent) => {
      const moved = travel(event.changedTouches[0])
      const staged = start?.staged
      start = null
      if (!staged || !moved) return
      if (
        Math.abs(moved.y) < SWIPE_MIN ||
        Math.abs(moved.y) <= Math.abs(moved.x)
      ) {
        return
      }
      goTo(activeRef.current + Math.sign(moved.y))
    }
    const onCancel = () => {
      start = null
    }

    section.addEventListener("touchstart", onStart, { passive: true })
    section.addEventListener("touchmove", onMove, { passive: false })
    section.addEventListener("touchend", onEnd, { passive: true })
    section.addEventListener("touchcancel", onCancel, { passive: true })
    return () => {
      section.removeEventListener("touchstart", onStart)
      section.removeEventListener("touchmove", onMove)
      section.removeEventListener("touchend", onEnd)
      section.removeEventListener("touchcancel", onCancel)
    }
  }, [goTo, reducedMotion, total])

  return { active, previous, moved, reducedMotion, sectionRef, goTo }
}
