import { useEffect, useRef, useState } from "react"
import usePrefersReducedMotion from "@/hooks/usePrefersReducedMotion"
import { useHighestSale } from "@/hooks/useHighestSale"
import { useI18n } from "@/i18n/i18nContext"
import { paths } from "@/router/paths"
import Container from "../ui/Container"
import Icon from "../ui/Icon"
import TextLink from "../ui/TextLink"
import "./SaleHighlight.css"

const BASE = import.meta.env.BASE_URL
/** First frame of the film; 32 KB, under the video until it plays. */
const POSTER = `${BASE}images/special-offer/special-offer-poster.webp`
/** The same film as before, re-encoded to the size each screen shows. */
const VIDEO = {
  wide: `${BASE}videos/special-offer-1280.mp4`,
  narrow: `${BASE}videos/special-offer-960.mp4`,
}

/** Visitors who asked to save data get the still frame only. */
const savesData = () =>
  Boolean(
    (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData,
  )

/*
 * Mid-page sale highlight, in the campaign layout the homepage had with the
 * mock catalogue (film beside an editorial headline, hairline terms row and
 * a text link), carrying today's real offer: "Up to X% Off", where X is the
 * highest discount a product card shows in the live catalogue right now
 * (useHighestSale), never a fixed figure. While that is being worked out the
 * section holds its place with the copy hidden and no figure; with no
 * genuine sale (or the mock catalogue, or a failed load) it is left out.
 *
 * The film never blocks the page: nothing but the lazy poster loads until
 * the section is near the viewport, then the right-sized file starts,
 * muted and inline, fading in over the poster once it plays; it pauses off
 * screen. Reduced motion or Save-Data shows the still frame only, and the
 * pause button stops it for good.
 */
export default function SaleHighlight() {
  const { t } = useI18n()
  const copy = t.home.saleHighlight
  const sale = useHighestSale()
  const reducedMotion = usePrefersReducedMotion()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [film] = useState(() => !savesData())
  const showVideo = film && !reducedMotion && sale.status !== "none"
  const userPausedRef = useRef(userPaused)
  userPausedRef.current = userPaused

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!video.getAttribute("src")) {
            video.src = matchMedia("(max-width: 767px)").matches
              ? VIDEO.narrow
              : VIDEO.wide
          }
          // Rejected when the browser blocks autoplay; the poster stays.
          if (!userPausedRef.current) video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { rootMargin: "200px 0px" },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [showVideo])

  if (sale.status === "none") return null
  const pending = sale.status === "pending"
  const figure = pending ? "" : copy.figure(sale.percentage)

  const togglePaused = () => {
    const video = videoRef.current
    if (!video) return
    if (userPaused) {
      setUserPaused(false)
      video.play().catch(() => {})
    } else {
      setUserPaused(true)
      video.pause()
    }
  }

  return (
    <Container
      as="section"
      className="sale-highlight"
      aria-labelledby={pending ? undefined : "sale-highlight-title"}
      aria-busy={pending || undefined}
    >
      <div className="sale-highlight__card">
        <div
          className={`sale-highlight__media${playing ? " is-playing" : ""}`}
          role="img"
          aria-label={copy.mediaAlt}
        >
          <img src={POSTER} alt="" loading="lazy" decoding="async" />
          {showVideo && (
            <video
              ref={videoRef}
              preload="none"
              muted
              loop
              playsInline
              disablePictureInPicture
              aria-hidden="true"
              tabIndex={-1}
              onPlaying={() => setPlaying(true)}
            />
          )}
          <span className="sale-highlight__caption" aria-hidden="true">
            {copy.caption}
          </span>
          {showVideo && playing && (
            <button
              type="button"
              className="sale-highlight__pause"
              aria-label={userPaused ? copy.playVideo : copy.pauseVideo}
              onClick={togglePaused}
            >
              <Icon name={userPaused ? "play" : "pause"} />
            </button>
          )}
        </div>

        <div
          className={`sale-highlight__copy${pending ? " is-pending" : ""}`}
          aria-hidden={pending || undefined}
        >
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2
            id="sale-highlight-title"
            className="editorial-heading sale-highlight__title"
          >
            {copy.lead} <br />
            <em>
              <bdi dir="ltr">{figure}</bdi>
            </em>
            {copy.trail && <> {copy.trail}</>}
          </h2>
          <p className="sale-highlight__description">{copy.description}</p>
          <p className="sale-highlight__terms">
            <span>{pending ? "" : copy.discountLabel(sale.percentage)}</span>
            <span>{copy.noCode}</span>
          </p>
          {pending ? (
            <span className="sale-highlight__link-placeholder" />
          ) : (
            <TextLink link={{ label: copy.cta, href: paths.products }} />
          )}
        </div>
      </div>
    </Container>
  )
}
