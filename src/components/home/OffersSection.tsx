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
import { useBag } from "@/cart/bagContext"
import usePrefersReducedMotion from "@/hooks/usePrefersReducedMotion"
import { useI18n } from "@/i18n/i18nContext"
import type { Product } from "@/types/catalog"
import type { NavigationItem, SectionIntro } from "@/types/content"
import ProductCard from "../product/ProductCard"
import { ProductSkeleton } from "../products/ProductGridSkeleton"
import Container from "../ui/Container"
import Icon from "../ui/Icon"
import SectionHeader from "../ui/SectionHeader"
import TextLink from "../ui/TextLink"
import "./OffersSection.css"

/** Places held for offers while the full catalogue is still on its way. */
const OFFER_SLOTS = 4
/** How long one position is shown before the rail moves on by a card (ms). */
const AUTOPLAY_DELAY = 3000
/** Quiet time after a swipe, scroll, arrow or key before autoplay resumes (ms). */
const RESUME_DELAY = 6000
/** Scroll inactivity after which a position in a loop copy is moved back (ms). */
const SETTLE_DELAY = 150

/** Named rather than inline: oxfmt 0.2.0 mangles single-line object types. */
interface PointerPosition {
  x: number
  y: number
}

/*
 * Homepage Offers: a horizontal rail of product cards that physically moves,
 * one card at a time, and loops. Live, it lists the merchant's Offers (Welp
 * `is_offer`) and then the Perfume Sets (services/catalog.ts
 * getFeaturedProducts); nothing here names a product.
 *
 * Native horizontal scrolling with CSS scroll snap, so touch swipes,
 * trackpads and Shift+wheel work as in any scroller, and the arrows scroll
 * to the neighbouring card. When there are more cards than fit, they are
 * rendered three times (the outer two copies are inert, aria-hidden clones):
 * once scrolling settles in an outer copy, the position jumps by exactly one
 * set to the identical card of the middle copy, so the rail loops both ways
 * and never rewinds. Same approach as TestimonialCarousel.
 *
 * Autoplay: one card every AUTOPLAY_DELAY while the rail is on screen and
 * the tab is visible. It never fights the visitor: pointer hover, keyboard
 * focus, a touch, a press, a horizontal wheel, the arrows and arrow keys
 * pause it, and it resumes RESUME_DELAY after the last input. The pause
 * button stops it until pressed again (WCAG 2.2.2); with reduced motion
 * requested it starts paused.
 *
 * Right to left, the rail starts at its right edge and later cards lie to
 * the left: scrollLeft and the cards' offsetLeft both run negative from the
 * same origin, so only a card's start edge (its right side) differs.
 *
 * Card widths are the earlier layout's: four across inside the container on
 * desktop, the same edge-to-edge swipe widths on tablet and phone.
 */
export default function OffersSection({
  intro,
  products,
  pending,
}: {
  intro: SectionIntro & { cta: NavigationItem }
  products: Product[]
  /** The full catalogue, where offers are found, is still on its way. */
  pending: boolean
}) {
  const { addItem } = useBag()
  const { t, dir } = useI18n()
  const text = t.home.offers
  const rtl = dir === "rtl"
  const reducedMotion = usePrefersReducedMotion()
  // The order (offers, then sets) needs the full catalogue: the newest page
  // alone would show sets first and then reshuffle. Until it is complete the
  // section holds its place with placeholders only.
  const items = pending ? [] : products
  const total = items.length
  const waiting = pending ? OFFER_SLOTS : 0

  const viewportRef = useRef<HTMLUListElement>(null)
  /** More cards than fit: the loop copies are rendered. Measured, never guessed. */
  const [loop, setLoop] = useState(false)
  /** Card a smooth scroll is heading to, so repeated presses build on it. */
  const targetRef = useRef<number | null>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [userPaused, setUserPaused] = useState(reducedMotion)
  useEffect(() => setUserPaused(reducedMotion), [reducedMotion])

  const hoveredRef = useRef(false)
  const focusedRef = useRef(false)
  const touchingRef = useRef(false)
  // No input yet: -Infinity, not 0 (0 is the page's start, which would hold
  // autoplay for RESUME_DELAY after every page load).
  const lastInputRef = useRef(-Infinity)
  const lastStepRef = useRef(0)
  const settleRef = useRef(0)
  const lastPointerRef = useRef<PointerPosition | null>(null)

  const slides = () =>
    Array.from(
      (viewportRef.current?.children ?? []) as HTMLCollectionOf<HTMLElement>,
    )

  /** The scroll position that puts a card's start edge at the rail's start. */
  const startOf = useCallback(
    (slide: HTMLElement) => {
      const viewport = viewportRef.current
      if (!viewport) return 0
      const padding =
        parseFloat(getComputedStyle(viewport).scrollPaddingInlineStart) || 0
      return rtl
        ? slide.offsetLeft + slide.offsetWidth - viewport.clientWidth + padding
        : slide.offsetLeft - padding
    },
    [rtl],
  )

  /** The card whose start edge is nearest the rail's start. */
  const currentIndex = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return 0
    let closest = 0
    let distance = Infinity
    slides().forEach((slide, index) => {
      const gap = Math.abs(startOf(slide) - viewport.scrollLeft)
      if (gap < distance) {
        closest = index
        distance = gap
      }
    })
    return closest
  }, [startOf])

  const scrollToSlide = useCallback(
    (index: number, behavior: ScrollBehavior) => {
      const viewport = viewportRef.current
      const slide = slides()[index]
      if (viewport && slide)
        viewport.scrollTo({ left: startOf(slide), behavior })
    },
    [startOf],
  )

  /** Cards that fit side by side in the rail at its current width. */
  const visibleCount = useCallback(() => {
    const viewport = viewportRef.current
    const [first, second] = slides()
    if (!viewport || !first) return 1
    const pitch = second
      ? Math.abs(second.offsetLeft - first.offsetLeft)
      : first.offsetWidth
    return Math.max(1, Math.floor((viewport.clientWidth + 2) / pitch))
  }, [])

  /** Non-looping rail: whether it is at either end (the arrow there is disabled). */
  const updateEnds = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const max = viewport.scrollWidth - viewport.clientWidth
    const position = Math.abs(viewport.scrollLeft)
    setAtStart(position <= 2)
    setAtEnd(position >= max - 2)
  }, [])

  // Loop only when the cards do not all fit; measured again when the width changes.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || pending || total < 2) {
      setLoop(false)
      return
    }
    setLoop(total > visibleCount())
    let width = viewport.clientWidth
    const observer = new ResizeObserver(() => {
      if (viewport.clientWidth === width) return
      width = viewport.clientWidth
      setLoop(total > visibleCount())
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [pending, total, visibleCount])

  // Start on the first real card (the middle copy when looping) before paint,
  // and again when the cards, the loop or the direction (language) change.
  useLayoutEffect(() => {
    targetRef.current = null
    scrollToSlide(loop ? total : 0, "auto")
    updateEnds()
  }, [loop, total, rtl, scrollToSlide, updateEnds])

  /** Moves a position inside an outer copy to the same card in the middle copy. */
  const recentre = useCallback(() => {
    if (!loop || touchingRef.current) return
    const index = currentIndex()
    if (index < total) scrollToSlide(index + total, "auto")
    else if (index >= total * 2) scrollToSlide(index - total, "auto")
  }, [loop, total, currentIndex, scrollToSlide])

  const onScroll = () => {
    window.clearTimeout(settleRef.current)
    settleRef.current = window.setTimeout(() => {
      targetRef.current = null
      recentre()
      updateEnds()
    }, SETTLE_DELAY)
  }
  useEffect(() => () => window.clearTimeout(settleRef.current), [])

  const step = useCallback(
    (direction: -1 | 1) => {
      const count = slides().length
      if (!count) return
      let from = targetRef.current ?? currentIndex()
      // In a loop, a step past the outer copies first moves (invisibly) to the
      // same card in the middle copy, so the smooth scroll always has room.
      if (loop && (from + direction < 0 || from + direction >= count)) {
        from = from < total ? from + total : from - total
        scrollToSlide(from, "auto")
      }
      const last = loop ? count - 1 : Math.max(0, total - visibleCount())
      const target = Math.max(0, Math.min(last, from + direction))
      targetRef.current = target
      lastStepRef.current = performance.now()
      scrollToSlide(target, reducedMotion ? "auto" : "smooth")
    },
    [loop, total, currentIndex, scrollToSlide, visibleCount, reducedMotion],
  )

  const markInput = () => {
    lastInputRef.current = performance.now()
  }

  // Autoplay: one card at a time while on screen, the tab visible, not paused.
  const autoplay = loop && !userPaused
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !autoplay) return
    let timer = 0
    const tick = () => {
      const now = performance.now()
      const held =
        document.visibilityState !== "visible" ||
        hoveredRef.current ||
        focusedRef.current ||
        touchingRef.current ||
        now - lastInputRef.current < RESUME_DELAY
      // Whatever held it, the next move comes a full interval later.
      if (held) lastStepRef.current = now
      else if (now - lastStepRef.current >= AUTOPLAY_DELAY) step(1)
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearInterval(timer)
        if (!entry.isIntersecting) return
        lastStepRef.current = performance.now()
        timer = window.setInterval(tick, 200)
      },
      { threshold: 0.35 },
    )
    observer.observe(viewport)
    return () => {
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [autoplay, step])

  const press = (direction: -1 | 1) => {
    markInput()
    step(direction)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.target !== event.currentTarget) return
    // Arrow keys move the way they point: later cards are to the left in Arabic.
    const forward = rtl ? "ArrowLeft" : "ArrowRight"
    const back = rtl ? "ArrowRight" : "ArrowLeft"
    if (event.key !== forward && event.key !== back) return
    event.preventDefault()
    press(event.key === forward ? 1 : -1)
  }

  /*
   * Mouse hover pauses only once the pointer itself moves over the cards: a
   * page scrolling under a resting cursor reports events at an unchanged
   * screen position, which are ignored.
   */
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") return
    const last = lastPointerRef.current
    lastPointerRef.current = { x: event.screenX, y: event.screenY }
    if (last && (last.x !== event.screenX || last.y !== event.screenY))
      hoveredRef.current = true
  }
  const onPointerLeave = () => {
    lastPointerRef.current = null
    hoveredRef.current = false
  }
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch") markInput()
  }
  // A horizontal trackpad swipe or Shift+wheel is input; vertical page scrolling is not.
  const onWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) markInput()
  }
  const onTouch = (touching: boolean) => () => {
    touchingRef.current = touching
    markInput()
    if (!touching) onScroll()
  }
  // Keyboard focus pauses; focus left behind by a mouse click does not.
  const onFocus = (event: FocusEvent<HTMLElement>) => {
    focusedRef.current = event.target.matches(":focus-visible")
  }
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return
    if (focusedRef.current) markInput()
    focusedRef.current = false
  }

  // With no offers the section is left out. Until the catalogue can say, its
  // place is held so the page below it stays still.
  if (!total && !pending) return null

  const copies = loop ? [0, 1, 2] : [1]
  const scrollable = loop || !(atStart && atEnd)
  const controls = !pending && total > 1 && scrollable

  return (
    <Container
      as="section"
      className="offers"
      id="products"
      aria-labelledby="offers-title"
      aria-roledescription="carousel"
      aria-busy={waiting > 0 || undefined}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <SectionHeader
        intro={intro}
        titleId="offers-title"
        action={<TextLink link={intro.cta} />}
      />
      <ul
        ref={viewportRef}
        className={`offers__rail${waiting > 0 ? " product-skeletons" : ""}`}
        tabIndex={controls ? 0 : undefined}
        aria-label={controls ? text.viewport : undefined}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onWheel={onWheel}
        onTouchStart={onTouch(true)}
        onTouchEnd={onTouch(false)}
        onTouchCancel={onTouch(false)}
      >
        {copies.flatMap((copy) =>
          items.map((product, index) =>
            copy === 1 ? (
              <li
                key={product.id}
                className="offers__slide"
                aria-roledescription="slide"
                aria-label={text.slide(index + 1, total)}
              >
                <ProductCard
                  product={product}
                  position={index + 1}
                  onAddToBag={addItem}
                />
              </li>
            ) : (
              // Loop clones: hidden from assistive technology and focus.
              <li
                key={`${product.id}-clone-${copy}`}
                className="offers__slide"
                aria-hidden="true"
                inert
              >
                <ProductCard
                  product={product}
                  position={index + 1}
                  onAddToBag={addItem}
                />
              </li>
            ),
          ),
        )}
        {Array.from({ length: waiting }, (_, index) => (
          <li
            key={`waiting-${index}`}
            className="offers__slide"
            aria-hidden="true"
          >
            <ProductSkeleton variant="editorial" />
          </li>
        ))}
      </ul>
      {/* Always in place (hidden while unused), so nothing shifts when it appears. */}
      <div className="offers__controls" hidden={!controls || undefined}>
        {controls && (
          <>
          {loop && (
            <button
              type="button"
              className="control-button"
              aria-label={userPaused ? text.play : text.pause}
              onClick={() => {
                markInput()
                setUserPaused((paused) => !paused)
              }}
            >
              <Icon name={userPaused ? "play" : "pause"} mirror={false} />
            </button>
          )}
          <button
            type="button"
            className="control-button control-button--previous"
            aria-label={text.previous}
            aria-disabled={!loop && atStart ? true : undefined}
            onClick={() => (loop || !atStart) && press(-1)}
          >
            <Icon name="chevron" />
          </button>
          <button
            type="button"
            className="control-button"
            aria-label={text.next}
            aria-disabled={!loop && atEnd ? true : undefined}
            onClick={() => (loop || !atEnd) && press(1)}
          >
            <Icon name="chevron" />
          </button>
          </>
        )}
      </div>
    </Container>
  )
}
