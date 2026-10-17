import { useEffect, useRef } from "react"
import type { SpecialOffer as SpecialOfferContent } from "@/types/content"
import usePrefersReducedMotion from "@/hooks/usePrefersReducedMotion"
import Container from "../ui/Container"
import EditorialHeading from "../ui/EditorialHeading"
import TextLink from "../ui/TextLink"
import "./SpecialOffer.css"

/*
 * The video only fetches metadata until the section nears the viewport, then
 * plays muted on a loop and pauses again once scrolled away. Under reduced
 * motion the still frame is rendered instead, so no video is downloaded.
 */
export default function SpecialOffer({
  offer,
}: {
  offer: SpecialOfferContent
}) {
  const reducedMotion = usePrefersReducedMotion()
  const videoRef = useRef<HTMLVideoElement>(null)
  const showVideo = Boolean(offer.video) && !reducedMotion

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Rejected when the browser blocks autoplay; the poster stays.
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { rootMargin: "200px 0px" },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [showVideo])

  return (
    <Container
      as="section"
      className="special-offer"
      aria-labelledby="special-offer-title"
    >
      <div className="special-offer__media">
        {showVideo && offer.video ? (
          <video
            ref={videoRef}
            poster={offer.image.src}
            preload="metadata"
            muted
            loop
            playsInline
            disablePictureInPicture
            role="img"
            aria-label={offer.image.alt}
          >
            <source src={offer.video.src} type={offer.video.type} />
          </video>
        ) : (
          <img
            src={offer.image.src}
            srcSet={offer.image.srcSet}
            sizes="(max-width: 767px) 100vw, 46vw"
            alt={offer.image.alt}
            loading="lazy"
          />
        )}
        {offer.imageCaption && (
          <span className="special-offer__caption" aria-hidden="true">
            {offer.imageCaption}
          </span>
        )}
      </div>
      <div className="special-offer__copy">
        <p className="eyebrow">{offer.eyebrow}</p>
        <EditorialHeading id="special-offer-title" heading={offer.heading} />
        <p className="special-offer__description">{offer.description}</p>
        <p className="special-offer__code">
          <span>{offer.discountLabel}</span>
          <span>
            {offer.codeLabel} {offer.code}
          </span>
        </p>
        <TextLink link={offer.cta} />
      </div>
    </Container>
  )
}
