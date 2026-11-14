import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react"
import {
  BUY3_PRODUCTS,
  SALE_PRODUCTS,
  type SpotlightProduct,
} from "@/config/spotlightProducts"
import { useCatalogState } from "@/hooks/useCatalogState"
import { useHighestSale } from "@/hooks/useHighestSale"
import usePrefersReducedMotion from "@/hooks/usePrefersReducedMotion"
import { useI18n } from "@/i18n/i18nContext"
import { cardSale } from "@/lib/productSale"
import { paths } from "@/router/paths"
import { getCatalog, getProductDetail, productSource } from "@/services/catalog"
import AppLink from "../ui/AppLink"
import Icon from "../ui/Icon"
import "./OfferSpotlight.css"

/*
 * Offer Spotlight: a small floating offer card shown over the site once per
 * browser session (OfferSpotlightGate decides when). Only the site's real
 * offers, as slides:
 *
 *   01  Buy 3 — Cheapest Item Free (the automatic bag promotion), with three
 *       real catalogue products.
 *   02  "Up to X% off", X being the same live highest card discount as the
 *       homepage sale highlight (useHighestSale), with real discounted
 *       products. Left out while there is no genuine sale, so no figure is
 *       ever invented.
 *
 * The bottles are cut-outs of the products' own company photos
 * (config/spotlightProducts), each shown only while the live catalogue still
 * lists it as available (and, on the sale offer, discounted). A product that
 * fails the check is left out, never replaced.
 *
 * Built on the native modal <dialog>: focus containment, background inertness
 * and Escape come from the browser; page scroll is locked by
 * `html:has(dialog[open])` in base.css.
 */

type SlideId = "buy3" | "sale"

const ALL_PRODUCTS = [...BUY3_PRODUCTS, ...SALE_PRODUCTS]

/**
 * The entries of `list` the live catalogue currently sells (and, with
 * `onSale`, shows a card discount for). Empty for the mock catalogue.
 */
function useSpotlightProducts(list: SpotlightProduct[], onSale: boolean) {
  const { locale } = useI18n()
  const { version, complete } = useCatalogState()
  return useMemo(() => {
    if (productSource !== "live" || !complete) return []
    const catalog = getCatalog(locale)
    return list.filter((entry) => {
      const product = catalog.find((item) => item.productId === entry.productId)
      if (!product?.inStock) return false
      if (!onSale) return true
      return cardSale(product, getProductDetail(entry.productId, locale)) !== undefined
    })
    // `version` re-reads the catalogue after it changes.
  }, [list, onSale, locale, complete, version])
}

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
  const buy3Products = useSpotlightProducts(BUY3_PRODUCTS, false)
  const saleProducts = useSpotlightProducts(SALE_PRODUCTS, true)
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
      ALL_PRODUCTS.map((source) => {
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
          <p className="spotlight__campaign">{copy.campaign}</p>
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
                {id === "buy3" ? (
                  <TrioVisual numeral={copy.buy3.numeral} products={buy3Products} />
                ) : null}
                {id === "sale" && sale.status === "ready" ? (
                  <SaleVisual
                    lead={copy.sale.lead}
                    figure={copy.sale.figure(sale.percentage)}
                    trail={copy.sale.trail}
                    products={saleProducts}
                  />
                ) : null}

                <div className="spotlight__copy">
                  <p className="spotlight__eyebrow">{copy[id].eyebrow}</p>
                  <h2 className="spotlight__headline">
                    <span>{copy[id].headline[0]}</span>{" "}
                    <span>
                      {copy[id].headline[1]}
                      <em>{copy[id].headline[2]}</em>
                    </span>
                  </h2>
                  <p className="spotlight__description">
                    {id === "sale" && sale.status === "ready"
                      ? copy.sale.description(sale.percentage)
                      : copy.buy3.description}
                  </p>
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
                    <span className="spotlight__bar-number" aria-hidden="true">
                      <bdi dir="ltr">{pad(index + 1)}</bdi>
                    </span>
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

/** One bottle; left out if its image ever fails rather than shown broken. */
function Bottle({ product, place }: { product: SpotlightProduct; place: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      className={`spotlight__bottle spotlight__bottle--${place}`}
      src={product.src}
      width={product.width}
      height={product.height}
      alt=""
      decoding="async"
      data-product-id={product.productId}
      onError={() => setFailed(true)}
    />
  )
}

/** The quiet stage the bottles stand on: tonal halo, fine plane, contact shadow. */
function Stage() {
  return (
    <>
      <span className="spotlight__halo" />
      <span className="spotlight__plane" />
      <span className="spotlight__ground" />
    </>
  )
}

const TRIO_PLACES = ["back", "front-start", "front-end"]
const DUO_PLACES = ["back", "front"]

/** Slide 01: a small cluster of three real products before a faint "03". Decorative. */
function TrioVisual({ numeral, products }: { numeral: string; products: SpotlightProduct[] }) {
  return (
    <div
      className="spotlight__visual spotlight__visual--trio"
      data-count={products.length}
      aria-hidden="true"
    >
      <Stage />
      <span className="spotlight__numeral">
        <bdi dir="ltr">{numeral}</bdi>
      </span>
      {products.map((product) => (
        <Bottle
          key={product.productId}
          product={product}
          place={TRIO_PLACES[BUY3_PRODUCTS.indexOf(product)]}
        />
      ))}
    </div>
  )
}

/**
 * Slide 02: "Up to X% off" as a compact statistic beside one or two real
 * sale products. The figure is also in the copy column, so this stays
 * decorative.
 */
function SaleVisual({
  lead,
  figure,
  trail,
  products,
}: {
  lead: string
  figure: string
  trail: string
  products: SpotlightProduct[]
}) {
  return (
    <div
      className="spotlight__visual spotlight__visual--sale"
      data-count={products.length}
      aria-hidden="true"
    >
      <Stage />
      <p className="spotlight__figure">
        <span className="spotlight__figure-lead">{lead}</span>
        <span className="spotlight__figure-amount">
          <bdi dir="ltr">{figure}</bdi>
        </span>
        {trail && <span className="spotlight__figure-trail">{trail}</span>}
      </p>
      {products.map((product) => (
        <Bottle
          key={product.productId}
          product={product}
          place={DUO_PLACES[SALE_PRODUCTS.indexOf(product)]}
        />
      ))}
    </div>
  )
}
