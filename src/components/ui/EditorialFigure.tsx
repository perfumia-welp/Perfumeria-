import { useEffect, useRef } from "react"
import type { CaptionedImage } from "@/types/content"
import usePrefersReducedMotion from "@/hooks/usePrefersReducedMotion"
import "./EditorialFigure.css"

/**
 * A cropped editorial photograph that fills its box (object-fit: cover),
 * with an optional decorative caption on the image.
 *
 * When the visual carries a video it plays muted on a loop while the figure
 * is near the viewport, over the image as its poster. Under reduced motion
 * the image is rendered instead, so no video is downloaded.
 */
interface EditorialFigureProps {
  visual: CaptionedImage
  sizes: string
  className?: string
  /** Above-the-fold images load eagerly with high priority. */
  priority?: boolean
}

export default function EditorialFigure({
  visual,
  sizes,
  className,
  priority = false,
}: EditorialFigureProps) {
  const reducedMotion = usePrefersReducedMotion()
  const videoRef = useRef<HTMLVideoElement>(null)
  const showVideo = Boolean(visual.video) && !reducedMotion

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
    <div
      className={[
        "editorial-figure",
        visual.video && "editorial-figure--video",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showVideo && visual.video ? (
        <video
          ref={videoRef}
          poster={visual.image.src}
          preload="none"
          muted
          loop
          playsInline
          disablePictureInPicture
          role="img"
          aria-label={visual.image.alt}
          style={{ objectPosition: visual.position }}
        >
          <source src={visual.video.src} type={visual.video.type} />
        </video>
      ) : (
        <img
          src={visual.image.src}
          srcSet={visual.image.srcSet}
          sizes={sizes}
          alt={visual.image.alt}
          style={{ objectPosition: visual.position }}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
        />
      )}
      {visual.caption && (
        <span className="editorial-figure__caption" aria-hidden="true">
          {visual.caption}
        </span>
      )}
    </div>
  )
}
