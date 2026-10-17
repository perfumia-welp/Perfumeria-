import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react"
import usePrefersReducedMotion from "@/hooks/usePrefersReducedMotion"
import { useI18n } from "@/i18n/i18nContext"
import type { SectionIntro, Testimonial } from "@/types/content"
import TestimonialCard from "../testimonial/TestimonialCard"
import Container from "../ui/Container"
import Icon from "../ui/Icon"
import SectionHeader from "../ui/SectionHeader"
import "./TestimonialCarousel.css"

const pad = (value: number) => String(value).padStart(2, "0")

/** Drift speed in CSS px per second. */
const DRIFT_SPEED = 20
/** Time constant (s) for easing the drift in and out. */
const DRIFT_EASING = 0.4
/** Quiet time (ms) after any interaction ends before drifting resumes. */
const RESUME_DELAY = 1500
/** Scroll inactivity (ms) after which the position is moved back to the middle set. */
const SETTLE_DELAY = 150
/** Window (ms) in which a horizontal nudge is attributed to vertical page scrolling. */
const PAGE_SCROLL_WINDOW = 200

/** Named rather than inline: oxfmt 0.2.0 mangles single-line object types. */
interface PointerPosition {
  x: number
  y: number
}

/*
 * Native scroll carousel rendered as three copies of the reviews (the outer
 * two are inert, aria-hidden clones) so it loops in both directions: once
 * scrolling settles, the position is shifted by exactly one set width back
 * into the middle copy, which is visually identical.
 *
 * Unless reduced motion is requested, the row drifts slowly in the reading
 * direction (right to left in English, left to right in Arabic) whenever it
 * is on screen. Only real interaction pauses it: the pointer
 * moving over the cards, keyboard focus, a touch or mouse press, a swipe or
 * horizontal scroll, and the arrows or arrow keys. Hover and focus ease the
 * drift to a halt; direct input stops it at once so it never fights the user.
 * It eases back in RESUME_DELAY after the interaction ends. Scrolling the page
 * so the cards pass under a resting cursor is not hover, and the slight
 * horizontal drift of a vertical trackpad scroll is not a swipe.
 *
 * scrollLeft only takes whole pixels, so the sub-pixel remainder is applied
 * as a translate on the slides to keep the slow movement smooth.
 *
 * Right to left, the row starts at the right edge and later reviews sit to
 * the left: scrollLeft and the slides' offsetLeft both run negative from the
 * same origin, so the centring maths is unchanged; only the direction of
 * travel (`forward`) and the sign of the set width flip.
 *
 * Buttons and arrow keys scroll to the measured position of the target card,
 * and the active index is read back from the scroll position so all inputs
 * stay in sync.
 */
export default function TestimonialCarousel({
  intro,
  testimonials,
}: {
  intro: SectionIntro
  testimonials: Testimonial[]
}) {
  const total = testimonials.length
  // Indexes below refer to all rendered slides; the real reviews start at `total`.
  const initialIndex = total + Math.floor((total - 1) / 2)

  const reducedMotion = usePrefersReducedMotion()
  const { t, dir } = useI18n()
  const text = t.home.testimonials
  /** Scroll direction of "next": +1 left to right, -1 right to left. */
  const forward = dir === "rtl" ? -1 : 1
  const drifting = !reducedMotion && total > 1
  const viewportRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(initialIndex)
  const pendingRef = useRef<number | null>(null)
  const frameRef = useRef(0)
  const settleRef = useRef(0)

  const hoveredRef = useRef(false)
  const focusedRef = useRef(false)
  const touchingRef = useRef(false)
  const lastInteractionRef = useRef(0)
  const lastPointerRef = useRef<PointerPosition | null>(null)
  const pageScrollRef = useRef(0)

  const [active, setActive] = useState(initialIndex)
  /** Review last announced to screen readers; the text is built at render. */
  const [announced, setAnnounced] = useState<number | null>(null)

  const slideCentre = (slide: HTMLElement) =>
    slide.offsetLeft + slide.offsetWidth / 2

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior) => {
      const viewport = viewportRef.current
      const slide = viewport?.children[index] as HTMLElement | undefined
      if (!viewport || !slide) return
      viewport.scrollTo({
        left: slideCentre(slide) - viewport.clientWidth / 2,
        behavior,
      })
    },
    [],
  )

  /**
   * Shifts the scroll position by one set width when it has left the middle
   * copy. Returns the shift applied (0 when none was needed).
   */
  const recentre = useCallback(
    (position: number) => {
      const viewport = viewportRef.current
      const first = viewport?.children[total] as HTMLElement | undefined
      const next = viewport?.children[total * 2] as HTMLElement | undefined
      if (!viewport || !first || !next) return 0
      // Negative right to left, where the next copy lies further left.
      const setWidth = next.offsetLeft - first.offsetLeft
      const origin = slideCentre(first) - viewport.clientWidth / 2
      // How far into the next (positive) or previous copy, in sets.
      const progress = (position - origin) / setWidth
      let shift = 0
      let indexShift = 0
      if (progress >= 0.5) {
        shift = -setWidth
        indexShift = -total
      } else if (progress < -0.5) {
        shift = setWidth
        indexShift = total
      }
      if (shift === 0) return 0
      activeRef.current += indexShift
      if (pendingRef.current !== null) pendingRef.current += indexShift
      return shift
    },
    [total],
  )

  // Start on the middle review, as in the approved design, before first paint.
  useLayoutEffect(() => {
    scrollToIndex(activeRef.current, "auto")
  }, [scrollToIndex])

  // A language switch flips the row's direction under the same scroll
  // position; once the new direction is applied, centre the active card again.
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() =>
      scrollToIndex(activeRef.current, "auto"),
    )
    return () => cancelAnimationFrame(frame)
  }, [dir, scrollToIndex])

  // Keep the active card centred when the layout width changes. Height-only
  // changes (fonts, images) are ignored so they never interrupt the drift.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    let width = viewport.clientWidth
    const observer = new ResizeObserver(() => {
      if (viewport.clientWidth === width) return
      width = viewport.clientWidth
      scrollToIndex(activeRef.current, "auto")
    })
    observer.observe(viewport)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frameRef.current)
      window.clearTimeout(settleRef.current)
    }
  }, [scrollToIndex])

  // Continuous drift, run only while the carousel is near the viewport.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !drifting) return

    let raf = 0
    let previousTime = 0
    let velocity = 0
    let position = viewport.scrollLeft
    let written = viewport.scrollLeft

    const setOffset = (offset: number) =>
      viewport.style.setProperty("--drift-offset", `${offset}px`)

    const tick = (time: number) => {
      const elapsed = previousTime ? (time - previousTime) / 1000 : 0
      const dt = Math.min(elapsed, 0.05)
      previousTime = time

      // Anything else moved the row: follow it. A swipe, horizontal scroll,
      // arrow or resize counts as interaction; vertical page-scroll noise not.
      if (Math.abs(viewport.scrollLeft - written) > 1) {
        position = viewport.scrollLeft
        written = position
        setOffset(0)
        if (performance.now() - pageScrollRef.current > PAGE_SCROLL_WINDOW) {
          velocity = 0
          lastInteractionRef.current = performance.now()
        }
      }

      // Direct input stops the drift at once so it never fights the user
      // (or a smooth arrow scroll); hover and focus ease it to a halt.
      const interacting =
        touchingRef.current ||
        performance.now() - lastInteractionRef.current < RESUME_DELAY
      const paused = interacting || hoveredRef.current || focusedRef.current
      const target = paused ? 0 : DRIFT_SPEED
      velocity += (target - velocity) * (1 - Math.exp(-dt / DRIFT_EASING))
      if (interacting) velocity = 0

      if (velocity > 0.05) {
        position += forward * velocity * dt
        position += recentre(position)
        const whole = Math.floor(position)
        viewport.scrollLeft = whole
        written = viewport.scrollLeft
        setOffset(-(position - written))
      }
      raf = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf)
      if (!entry.isIntersecting) return
      previousTime = 0
      position = viewport.scrollLeft
      written = position
      raf = requestAnimationFrame(tick)
    })
    observer.observe(viewport)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
      setOffset(0)
    }
  }, [drifting, recentre, forward])

  const syncActiveFromScroll = () => {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      const viewport = viewportRef.current
      if (!viewport) return
      const centre = viewport.scrollLeft + viewport.clientWidth / 2
      let closest = 0
      let closestDistance = Infinity
      Array.from(viewport.children as HTMLCollectionOf<HTMLElement>).forEach(
        (slide, index) => {
          const distance = Math.abs(slideCentre(slide) - centre)
          if (distance < closestDistance) {
            closest = index
            closestDistance = distance
          }
        },
      )
      if (pendingRef.current === closest) pendingRef.current = null
      activeRef.current = closest
      setActive(closest)
    })

    // Once manual scrolling settles, quietly move back to the middle copy.
    window.clearTimeout(settleRef.current)
    settleRef.current = window.setTimeout(() => {
      const viewport = viewportRef.current
      if (!viewport || touchingRef.current) return
      const shift = recentre(viewport.scrollLeft)
      if (shift) viewport.scrollLeft += shift
    }, SETTLE_DELAY)
  }

  const goTo = (index: number) => {
    const target = Math.max(0, Math.min(total * 3 - 1, index))
    pendingRef.current = target
    lastInteractionRef.current = performance.now()
    scrollToIndex(target, reducedMotion ? "auto" : "smooth")
    setAnnounced(target % total)
  }

  // Repeated presses build on the card already being scrolled to.
  const step = (direction: -1 | 1) =>
    goTo((pendingRef.current ?? active) + direction)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const setStart = active - (active % total)
    // Arrow keys move the way they point: next is to the left in Arabic.
    const actions: Record<string, () => void> = {
      ArrowLeft: () => step(forward === 1 ? -1 : 1),
      ArrowRight: () => step(forward === 1 ? 1 : -1),
      Home: () => goTo(setStart),
      End: () => goTo(setStart + total - 1),
    }
    const action = actions[event.key]
    if (!action) return
    event.preventDefault()
    action()
  }

  const markInteraction = () => {
    lastInteractionRef.current = performance.now()
  }

  /*
   * Mouse/pen hover only, and only once the pointer itself moves over the
   * cards: when the page scrolls beneath a resting cursor the browser reports
   * pointer events at an unchanged screen position, which are ignored.
   */
  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") return
    const last = lastPointerRef.current
    lastPointerRef.current = { x: event.screenX, y: event.screenY }
    if (last && (last.x !== event.screenX || last.y !== event.screenY)) {
      hoveredRef.current = true
    }
  }

  const handlePointerLeave = () => {
    lastPointerRef.current = null
    if (hoveredRef.current) markInteraction()
    hoveredRef.current = false
  }

  // A mouse press (e.g. selecting text) pauses like a touch does.
  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch") markInteraction()
  }

  const handleWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      pageScrollRef.current = performance.now()
    }
  }

  // Keyboard focus pauses; focus left behind by a mouse click does not.
  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    focusedRef.current = event.target.matches(":focus-visible")
  }

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return
    if (focusedRef.current) markInteraction()
    focusedRef.current = false
  }

  const handleTouch = (touching: boolean) => () => {
    touchingRef.current = touching
    markInteraction()
  }

  const slides = [0, 1, 2].flatMap((copy) =>
    testimonials.map((testimonial, index) => ({ testimonial, index, copy })),
  )

  return (
    <section
      className="testimonials"
      aria-roledescription="carousel"
      aria-labelledby="testimonials-title"
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <Container>
        <SectionHeader
          intro={intro}
          titleId="testimonials-title"
          className="testimonials__header"
        />
      </Container>

      <div
        ref={viewportRef}
        className={
          drifting
            ? "testimonials__viewport testimonials__viewport--drifting"
            : "testimonials__viewport"
        }
        tabIndex={0}
        role="group"
        aria-label={text.viewport}
        onScroll={syncActiveFromScroll}
        onKeyDown={handleKeyDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onWheel={handleWheel}
        onTouchStart={handleTouch(true)}
        onTouchEnd={handleTouch(false)}
        onTouchCancel={handleTouch(false)}
      >
        {slides.map(({ testimonial, index, copy }) =>
          copy === 1 ? (
            <div
              key={testimonial.id}
              className="testimonials__slide"
              role="group"
              aria-roledescription="slide"
              aria-label={text.slide(index + 1, total)}
            >
              <TestimonialCard testimonial={testimonial} />
            </div>
          ) : (
            // Loop clones: hidden from assistive technology and focus.
            <div
              key={`${testimonial.id}-clone-${copy}`}
              className="testimonials__slide"
              aria-hidden="true"
              inert
            >
              <TestimonialCard testimonial={testimonial} />
            </div>
          ),
        )}
      </div>

      <Container className="testimonials__controls">
        <span aria-hidden="true">
          {pad((active % total) + 1)} / {pad(total)}
        </span>
        <div>
          <button
            type="button"
            className="control-button control-button--previous"
            aria-label={text.previous}
            onClick={() => step(-1)}
          >
            <Icon name="chevron" />
          </button>
          <button
            type="button"
            className="control-button"
            aria-label={text.next}
            onClick={() => step(1)}
          >
            <Icon name="chevron" />
          </button>
        </div>
        <p className="visually-hidden" aria-live="polite" aria-atomic="true">
          {announced === null ? "" : text.announcement(announced + 1, total)}
        </p>
      </Container>
    </section>
  )
}
