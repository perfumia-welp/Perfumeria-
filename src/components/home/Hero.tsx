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
import type { HeroContent } from "@/types/content"
import AppLink from "../ui/AppLink"
import EditorialHeading from "../ui/EditorialHeading"
import Icon from "../ui/Icon"
import "./Hero.css"

/** Minimum horizontal travel, in px, for a touch swipe to change slide. */
const SWIPE_THRESHOLD = 40

interface Point {
  x: number
  y: number
}

const pad = (value: number) => String(value).padStart(2, "0")

/*
 * Autoplay is driven by the CSS progress line (7s, see Hero.css): when its
 * animation ends the next slide is shown. Pausing pauses the animation and a
 * slide change restarts it, so pause, resume and timer reset stay in sync.
 * Under reduced motion the animation is removed, so autoplay never starts.
 */
export default function Hero({ content }: { content: HeroContent }) {
  const { slides } = content
  const total = slides.length
  const hasMultipleSlides = total > 1

  const reducedMotion = usePrefersReducedMotion()
  const { t, dir } = useI18n()
  const copy = t.home.carousel
  /** Next is the reading direction: right in English, left in Arabic. */
  const forward = dir === "rtl" ? -1 : 1
  const sectionRef = useRef<HTMLElement>(null)
  const swipeStart = useRef<Point | null>(null)

  const [active, setActive] = useState(0)
  /** Index of the slide last announced to screen readers (text built at render). */
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") goTo(active - forward, true)
    else if (event.key === "ArrowRight") goTo(active + forward, true)
    else return
    event.preventDefault()
  }

  // Keyboard focus pauses autoplay; a mouse click on a control does not.
  const handleFocus = (event: FocusEvent<HTMLElement>) =>
    setKeyboardFocused(event.target.matches(":focus-visible"))

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setKeyboardFocused(false)
    }
  }

  const handleSwipeStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return
    swipeStart.current = { x: event.clientX, y: event.clientY }
  }

  const handleSwipeEnd = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || !hasMultipleSlides) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      goTo(active + (dx < 0 ? forward : -forward), true)
    }
  }

  const activeSlide = slides[active]
  const announcement =
    announced === null
      ? ""
      : copy.announcement(announced + 1, total, slides[announced].mood)

  return (
    <section
      ref={sectionRef}
      className={`hero${paused ? " is-paused" : ""}`}
      aria-roledescription="carousel"
      aria-labelledby="hero-title"
      onPointerEnter={(event) =>
        event.pointerType === "mouse" && setHovered(true)
      }
      onPointerLeave={() => setHovered(false)}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div className="hero__copy">
        <p className="eyebrow">{content.eyebrow}</p>
        <EditorialHeading
          as="h1"
          id="hero-title"
          className="hero__title"
          heading={content.heading}
        />

        {/* Descriptions share one grid cell, so changing slide never shifts the layout. */}
        <div className="hero__descriptions">
          {slides.map((slide, index) => (
            <p
              key={slide.id}
              className={`hero__description${
                index === active ? " is-active" : ""
              }`}
            >
              {slide.description}
            </p>
          ))}
        </div>

        <AppLink className="button-primary" href={content.cta.href}>
          {content.cta.label} <Icon name="arrow" />
        </AppLink>

        {hasMultipleSlides && (
          <div className="hero__footer">
            <div className="hero__index" aria-hidden="true">
              <span>{pad(active + 1)}</span>
              <i className="hero__progress">
                {/* Re-keyed per slide so the 7s line restarts on every change. */}
                <span
                  key={active}
                  className="hero__progress-fill"
                  onAnimationEnd={() => !paused && goTo(active + 1, false)}
                />
              </i>
              <span>{pad(total)}</span>
              <span key={activeSlide.id} className="hero__mood">
                {activeSlide.mood}
              </span>
            </div>

            <div
              className="hero__controls"
              role="group"
              aria-label={copy.controls}
              onKeyDown={handleKeyDown}
            >
              <button
                type="button"
                className="control-button control-button--previous"
                aria-label={copy.previous}
                onClick={() => goTo(active - 1, true)}
              >
                <Icon name="chevron" />
              </button>
              <button
                type="button"
                className="control-button"
                aria-label={copy.next}
                onClick={() => goTo(active + 1, true)}
              >
                <Icon name="chevron" />
              </button>
              {!reducedMotion && (
                <button
                  type="button"
                  className="control-button hero__toggle"
                  aria-label={userPaused ? copy.play : copy.pause}
                  onClick={() => setUserPaused((value) => !value)}
                >
                  <Icon name={userPaused ? "play" : "pause"} />
                </button>
              )}
            </div>

            <p
              className="visually-hidden"
              aria-live="polite"
              aria-atomic="true"
            >
              {announcement}
            </p>
          </div>
        )}
      </div>

      <div
        className="hero__visual"
        onPointerDown={handleSwipeStart}
        onPointerUp={handleSwipeEnd}
        onPointerCancel={() => (swipeStart.current = null)}
      >
        {slides.map((slide, index) => {
          const isActive = index === active
          return (
            <div
              key={slide.id}
              className={`hero__slide${isActive ? " is-active" : ""}`}
              role="group"
              aria-roledescription="slide"
              aria-label={copy.slide(index + 1, total, slide.mood)}
              aria-hidden={!isActive}
            >
              <img
                src={slide.image.src}
                srcSet={slide.image.srcSet}
                sizes="(max-width: 767px) 100vw, 46vw"
                alt={slide.image.alt}
                style={{ objectPosition: slide.imagePosition }}
                fetchPriority={index === 0 ? "high" : "low"}
              />
              <span className="hero__caption" aria-hidden="true">
                {slide.notes.join(" · ")}
              </span>
            </div>
          )
        })}
        <span className="hero__sheen" aria-hidden="true" />
      </div>
    </section>
  )
}
