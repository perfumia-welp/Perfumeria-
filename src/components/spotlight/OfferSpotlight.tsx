import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react"
import { LIVE_HERO_CUTOUTS } from "@/config/heroCutouts"
import { brand } from "@/data/site"
import { useHighestSale } from "@/hooks/useHighestSale"
import usePrefersReducedMotion from "@/hooks/usePrefersReducedMotion"
import { useI18n } from "@/i18n/i18nContext"
import { paths } from "@/router/paths"
import AppLink from "../ui/AppLink"
import Icon from "../ui/Icon"
import "./OfferSpotlight.css"

/*
 * Offer Spotlight: an editorial campaign card shown over the site once per
 * browser session (OfferSpotlightGate decides when). Only the site's real
 * offers, as slides:
 *
 *   01  Buy 3 — Cheapest Item Free (the automatic bag promotion).
 *   02  "Up to X% off", X being the same live highest card discount as the
 *       homepage sale highlight (useHighestSale). Left out while there is no
 *       genuine sale, so no figure is ever invented.
 *
 * Built on the native modal <dialog>: focus containment, background inertness
 * and Escape come from the browser; page scroll is locked by
 * `html:has(dialog[open])` in base.css. The bottles are the transparent
 * cut-outs the site already ships (config/heroCutouts), ~186 KB in all,
 * requested only when this chunk loads, after the page itself.
 */

type SlideId = "buy3" | "sale"

const bottle = (id: number) => LIVE_HERO_CUTOUTS[id]
// Dior J'adore, YSL Mon Paris, Versace Dylan Blue.
const JADORE = bottle(14075)
const MON_PARIS = bottle(14097)
const DYLAN_BLUE = bottle(13898)
const BOTTLES = [JADORE, MON_PARIS, DYLAN_BLUE]

/** Longest wait for the bottles and the sale figure before opening anyway. */
const MAX_WAIT_MS = 6000
/** Time for the closing fade before the card is removed. */
const EXIT_MS = 450
/** Minimum horizontal travel, in px, for a touch swipe to change offer. */
const SWIPE_THRESHOLD = 40

const pad = (value: number) => String(value).padStart(2, "0")

interface OfferSpotlightProps {
  /** False on pages the card must not open over (bag, checkout…). */
  eligible: boolean
  /** Offer shown first (0-based); dev review only, otherwise 0. */
  initialSlide: number
  /** The visitor closed the card: remember it for this session. */
  onDismissed: () => void
  /** The closing fade has finished: the card can be removed. */
  onClosed: () => void
}

export default function OfferSpotlight({
  eligible,
  initialSlide,
  onDismissed,
  onClosed,
}: OfferSpotlightProps) {
  const { t, dir } = useI18n()
  const copy = t.home.spotlight
  const sale = useHighestSale()
  const reducedMotion = usePrefersReducedMotion()

  const dialogRef = useRef<HTMLDialogElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<Element | null>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const slides: SlideId[] = sale.status === "ready" ? ["buy3", "sale"] : ["buy3"]
  const total = slides.length
  const [requested, setRequested] = useState(initialSlide)
  const active = Math.min(requested, total - 1)

  const [opened, setOpened] = useState(false)
  const [imagesReady, setImagesReady] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [hovered, setHovered] = useState(false)
  // Any use of the controls stops autoplay for good.
  const [stopped, setStopped] = useState(false)
  const [announcement, setAnnouncement] = useState("")

  // Decode the bottles before opening, so the card never appears half drawn.
  useEffect(() => {
    let cancelled = false
    void Promise.all(
      BOTTLES.map((source) => {
        const image = new Image()
        image.src = source.src
        return image.decode().catch(() => {})
      }),
    ).then(() => {
      if (!cancelled) setImagesReady(true)
    })
    const timer = window.setTimeout(() => setTimedOut(true), MAX_WAIT_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  // Waits for the real sale figure (or its absence), then opens once.
  const canOpen =
    eligible && ((imagesReady && sale.status !== "pending") || timedOut)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || opened || !canOpen) return
    returnFocus.current = document.activeElement
    dialog.showModal()
    // Focus the card itself: the dialog's name is read first, and the close
    // button is the next Tab stop.
    cardRef.current?.focus({ preventScroll: true })
    setOpened(true)
  }, [canOpen, opened])

  const close = () => dialogRef.current?.close()

  // Fired for every way of closing: ×, Escape, backdrop, a call to action.
  const handleClose = () => {
    onDismissed()
    const previous = returnFocus.current
    if (
      previous instanceof HTMLElement &&
      previous !== document.body &&
      previous.isConnected
    )
      previous.focus({ preventScroll: true })
    else document.getElementById("main")?.focus({ preventScroll: true })
    window.setTimeout(onClosed, EXIT_MS)
  }

  // A click whose target is the <dialog> itself landed on the backdrop.
  const handleDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) close()
  }

  const name = (id: SlideId) => (id === "buy3" ? copy.buy3.name : copy.sale.name)

  const show = (index: number, byUser: boolean) => {
    const next = (index + total) % total
    setRequested(next)
    if (byUser) {
      setStopped(true)
      setAnnouncement(copy.announcement(next + 1, total, name(slides[next])))
    }
  }

  const forward = dir === "rtl" ? -1 : 1
  const handleControlsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowRight: forward,
      ArrowLeft: -forward,
    }
    if (event.key in steps) {
      event.preventDefault()
      show(active + steps[event.key], true)
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      show(event.key === "Home" ? 0 : total - 1, true)
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch")
      swipeStart.current = { x: event.clientX, y: event.clientY }
  }
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || total < 2) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return
    show(active + (dx < 0 ? forward : -forward), true)
  }

  const autoplay = opened && total > 1 && !reducedMotion && !stopped
  const classes = [
    "spotlight",
    autoplay && "is-autoplay",
    hovered && "is-paused",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <dialog
      ref={dialogRef}
      className={classes}
      aria-label={copy.dialogLabel}
      onClose={handleClose}
      onClick={handleDialogClick}
    >
      <div
        ref={cardRef}
        className="spotlight__card"
        tabIndex={-1}
        onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
        onPointerLeave={(event) => event.pointerType === "mouse" && setHovered(false)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <header className="spotlight__header">
          <p className="spotlight__campaign">
            <span className="spotlight__wordmark" lang="en" dir="ltr">
              {brand.name}
            </span>
            <span className="spotlight__campaign-rule" aria-hidden="true" />
            <span className="spotlight__campaign-name">{copy.campaign}</span>
          </p>
          <button
            type="button"
            className="spotlight__close"
            aria-label={copy.close}
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="spotlight__slides" aria-roledescription="carousel">
          {slides.map((id, index) => {
            const isActive = index === active
            return (
              <div
                key={id}
                className={`spotlight__slide spotlight__slide--${id}${
                  isActive ? " is-active" : ""
                }`}
                role="group"
                aria-roledescription="slide"
                aria-label={copy.slide(index + 1, total)}
                aria-hidden={!isActive}
                inert={!isActive}
              >
                {id === "buy3" ? <TrioVisual numeral={copy.buy3.numeral} /> : null}
                {id === "sale" && sale.status === "ready" ? (
                  <SaleVisual
                    lead={copy.sale.lead}
                    figure={copy.sale.figure(sale.percentage)}
                    trail={copy.sale.trail}
                  />
                ) : null}

                <div className="spotlight__copy">
                  <p className="spotlight__eyebrow">{copy.eyebrow(pad(index + 1))}</p>
                  {id === "sale" && sale.status === "ready" && (
                    <p className="visually-hidden">{copy.sale.summary(sale.percentage)}</p>
                  )}
                  <h2 className="spotlight__headline">
                    <span>{copy[id].headline[0]}</span>{" "}
                    <em>{copy[id].headline[1]}</em>
                  </h2>
                  <p className="spotlight__description">{copy[id].description}</p>
                  <AppLink
                    className="button-primary spotlight__cta"
                    href={paths.products}
                    onClick={close}
                  >
                    <span>{copy[id].cta}</span>
                    <Icon name="arrow" />
                  </AppLink>
                </div>
              </div>
            )
          })}
        </div>

        {total > 1 && (
          <div className="spotlight__footer">
            <div
              className="spotlight__controls"
              role="group"
              aria-label={copy.controls}
              onKeyDown={handleControlsKeyDown}
            >
              <div className="spotlight__bars">
                {slides.map((id, index) => (
                  <button
                    key={id}
                    type="button"
                    className={`spotlight__bar${index === active ? " is-active" : ""}`}
                    aria-label={copy.goTo(index + 1, total)}
                    aria-current={index === active ? "true" : undefined}
                    onClick={() => show(index, true)}
                  >
                    <span className="spotlight__bar-track">
                      {index === active && (
                        <span
                          // Re-mounted on every change, so the timer restarts.
                          key={active}
                          className="spotlight__bar-fill"
                          onAnimationEnd={
                            autoplay ? () => show(active + 1, false) : undefined
                          }
                        />
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <span className="spotlight__index" aria-hidden="true">
                <bdi dir="ltr">
                  {pad(active + 1)} <i>/</i> {pad(total)}
                </bdi>
              </span>
              <div className="spotlight__arrows">
                <button
                  type="button"
                  className="spotlight__arrow spotlight__arrow--previous"
                  aria-label={copy.previous}
                  onClick={() => show(active - 1, true)}
                >
                  <Icon name="arrow" />
                </button>
                <button
                  type="button"
                  className="spotlight__arrow"
                  aria-label={copy.next}
                  onClick={() => show(active + 1, true)}
                >
                  <Icon name="arrow" />
                </button>
              </div>
            </div>
            <p className="visually-hidden" aria-live="polite" aria-atomic="true">
              {announcement}
            </p>
          </div>
        )}
      </div>
    </dialog>
  )
}

/** Slide 01: three bottles before an oversized "03". Decorative. */
function TrioVisual({ numeral }: { numeral: string }) {
  return (
    <div className="spotlight__visual spotlight__visual--trio" aria-hidden="true">
      <span className="spotlight__panel" />
      {/* No dir="ltr" here: its inline-end must follow the page (digits stay in order anyway). */}
      <span className="spotlight__numeral">{numeral}</span>
      <span className="spotlight__ground" />
      <img
        className="spotlight__bottle spotlight__bottle--back"
        src={JADORE.src}
        width={JADORE.width}
        height={JADORE.height}
        alt=""
        decoding="async"
      />
      <img
        className="spotlight__bottle spotlight__bottle--front-start"
        src={MON_PARIS.src}
        width={MON_PARIS.width}
        height={MON_PARIS.height}
        alt=""
        decoding="async"
      />
      <img
        className="spotlight__bottle spotlight__bottle--front-end"
        src={DYLAN_BLUE.src}
        width={DYLAN_BLUE.width}
        height={DYLAN_BLUE.height}
        alt=""
        decoding="async"
      />
    </div>
  )
}

/**
 * Slide 02: "Up to X% Off" as campaign typography, one bottle over it. The
 * figure is read out from the copy column (visually hidden summary), so this
 * stays decorative.
 */
function SaleVisual({
  lead,
  figure,
  trail,
}: {
  lead: string
  figure: string
  trail: string
}) {
  return (
    <div className="spotlight__visual spotlight__visual--sale" aria-hidden="true">
      <span className="spotlight__panel" />
      <p className="spotlight__figure">
        <span className="spotlight__figure-lead">{lead}</span>
        <span className="spotlight__figure-amount">
          <bdi dir="ltr">{figure}</bdi>
        </span>
        {trail && <span className="spotlight__figure-trail">{trail}</span>}
      </p>
      <span className="spotlight__ground" />
      <img
        className="spotlight__bottle spotlight__bottle--solo"
        src={MON_PARIS.src}
        width={MON_PARIS.width}
        height={MON_PARIS.height}
        alt=""
        decoding="async"
      />
    </div>
  )
}
