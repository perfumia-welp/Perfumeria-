import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react"
import usePrefersReducedMotion from "@/hooks/usePrefersReducedMotion"
import { useI18n } from "@/i18n/i18nContext"
import type { HeroSlide } from "@/types/content"

/*
 * TEMPORARY (hero comparison): the slideshow behaviour of the approved Hero,
 * extracted unchanged so HeroCampaign behaves identically. Hero.tsx still
 * carries its own copy so the approved hero is untouched during the
 * experiment; once a direction is chosen, keep one of the two.
 */

/** Minimum horizontal travel, in px, for a touch swipe to change slide. */
const SWIPE_THRESHOLD = 40

interface Point {
  x: number
  y: number
}

/**
 * Autoplay is driven by a CSS progress animation (7s): its `animationend`
 * calls `advance`. Pausing pauses the animation and a slide change restarts
 * it. Under reduced motion autoplay never starts.
 */
export default function useHeroCarousel(slides: HeroSlide[]) {
  const total = slides.length
  const hasMultipleSlides = total > 1

  const reducedMotion = usePrefersReducedMotion()
  const { t, dir } = useI18n()
  const forward = dir === "rtl" ? -1 : 1
  const sectionRef = useRef<HTMLElement>(null)
  const swipeStart = useRef<Point | null>(null)

  const [active, setActive] = useState(0)
  const [announced, setAnnounced] = useState<number | null>(null)
  const [userPaused, setUserPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [keyboardFocused, setKeyboardFocused] = useState(false)
  const [inView, setInView] = useState(true)

  const autoplay = hasMultipleSlides && !reducedMotion && !userPaused
  const paused = !autoplay || hovered || keyboardFocused || !inView

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry.isIntersecting),
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  const goTo = (index: number, announce: boolean) => {
    const next = (index + total) % total
    setActive(next)
    if (announce) setAnnounced(next)
  }

  const sectionHandlers = {
    onPointerEnter: (event: PointerEvent<HTMLElement>) =>
      event.pointerType === "mouse" && setHovered(true),
    onPointerLeave: () => setHovered(false),
    // Keyboard focus pauses autoplay; a mouse click on a control does not.
    onFocus: (event: FocusEvent<HTMLElement>) =>
      setKeyboardFocused(event.target.matches(":focus-visible")),
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setKeyboardFocused(false)
      }
    },
  }

  const swipeHandlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse") return
      swipeStart.current = { x: event.clientX, y: event.clientY }
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const start = swipeStart.current
      swipeStart.current = null
      if (!start || !hasMultipleSlides) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        goTo(active + (dx < 0 ? forward : -forward), true)
      }
    },
    onPointerCancel: () => {
      swipeStart.current = null
    },
  }

  const handleControlsKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft") goTo(active - forward, true)
    else if (event.key === "ArrowRight") goTo(active + forward, true)
    else return
    event.preventDefault()
  }

  return {
    active,
    total,
    hasMultipleSlides,
    reducedMotion,
    paused,
    userPaused,
    announcement:
      announced === null
        ? ""
        : t.home.carousel.announcement(
            announced + 1,
            total,
            slides[announced].mood,
          ),
    sectionRef,
    sectionHandlers,
    swipeHandlers,
    handleControlsKeyDown,
    previous: () => goTo(active - 1, true),
    next: () => goTo(active + 1, true),
    /** Called when the progress animation completes. */
    advance: () => !paused && goTo(active + 1, false),
    togglePaused: () => setUserPaused((value) => !value),
  }
}
