import type { CSSProperties } from "react"
import { useI18n } from "@/i18n/i18nContext"
import type { HeroContent } from "@/types/content"
import AppLink from "../ui/AppLink"
import EditorialHeading from "../ui/EditorialHeading"
import Icon from "../ui/Icon"
import useHeroCarousel from "./useHeroCarousel"
import "./HeroCampaign.css"

/*
 * TEMPORARY (hero comparison): "Hero B", a full-bleed campaign alternative to
 * the approved split Hero. Same content and carousel behaviour; only the
 * composition differs. Delete this file, HeroCampaign.css, useHeroCarousel.ts
 * and HeroVariantToggle.* once a direction is chosen.
 *
 * The current photographs are portrait, so a plain full-width crop would cut
 * the bottles in half. Instead each slide is a soft, toned, blurred copy of
 * the photograph filling the whole stage (where the copy sits), with the sharp
 * photograph on the right melting into it through a gradient mask. On phones
 * the photograph fills the top of the stage and fades into the same backdrop.
 */

/** Per-slide crops for this composition only, keyed by slide id. */
interface SlideCrop {
  desktop: string
  mobile: string
}

const ART_DIRECTION: Record<string, SlideCrop> = {
  floral: { desktop: "50% 54%", mobile: "60% 92%" },
  amber: { desktop: "50% 60%", mobile: "50% 100%" },
  oud: { desktop: "50% 73%", mobile: "62% 100%" },
}

const pad = (value: number) => String(value).padStart(2, "0")

export default function HeroCampaign({ content }: { content: HeroContent }) {
  const { slides } = content
  const carousel = useHeroCarousel(slides)
  const copy = useI18n().t.home.carousel
  const { active, total, paused } = carousel
  const activeSlide = slides[active]

  return (
    <section
      ref={carousel.sectionRef}
      className={`hero-campaign${paused ? " is-paused" : ""}`}
      aria-roledescription="carousel"
      aria-labelledby="hero-title"
      {...carousel.sectionHandlers}
      {...carousel.swipeHandlers}
    >
      <div className="hero-campaign__stage">
        {slides.map((slide, index) => {
          const isActive = index === active
          const crop = ART_DIRECTION[slide.id]
          return (
            <div
              key={slide.id}
              className={`hero-campaign__slide${isActive ? " is-active" : ""}`}
              role="group"
              aria-roledescription="slide"
              aria-label={copy.slide(index + 1, total, slide.mood)}
              aria-hidden={!isActive}
              style={
                {
                  "--crop-desktop": crop?.desktop ?? slide.imagePosition,
                  "--crop-mobile": crop?.mobile ?? slide.imagePosition,
                } as CSSProperties
              }
            >
              <img
                className="hero-campaign__backdrop"
                src={slide.image.src}
                alt=""
                aria-hidden="true"
              />
              <img
                className="hero-campaign__image"
                src={slide.image.src}
                srcSet={slide.image.srcSet}
                sizes="(max-width: 767px) 100vw, 52vw"
                alt={slide.image.alt}
                fetchPriority={index === 0 ? "high" : "low"}
              />
            </div>
          )
        })}
        <span className="hero-campaign__shade" aria-hidden="true" />
      </div>

      <div className="page-container hero-campaign__content">
        <div className="hero-campaign__copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <EditorialHeading
            as="h1"
            id="hero-title"
            className="hero-campaign__title"
            heading={content.heading}
          />

          {/* Descriptions share one grid cell, so changing slide never shifts the layout. */}
          <div className="hero-campaign__descriptions">
            {slides.map((slide, index) => (
              <p
                key={slide.id}
                className={`hero-campaign__description${
                  index === active ? " is-active" : ""
                }`}
              >
                {slide.description}
              </p>
            ))}
          </div>

          <AppLink
            className="button-primary hero-campaign__cta"
            href={content.cta.href}
          >
            {content.cta.label} <Icon name="arrow" />
          </AppLink>
        </div>

        {carousel.hasMultipleSlides && (
          <div className="hero-campaign__footer">
            <div className="hero-campaign__index" aria-hidden="true">
              <span>{pad(active + 1)}</span>
              <i className="hero-campaign__progress">
                {/* Re-keyed per slide so the 7s line restarts on every change. */}
                <span
                  key={active}
                  className="hero-campaign__progress-fill"
                  onAnimationEnd={carousel.advance}
                />
              </i>
              <span>{pad(total)}</span>
              <span key={activeSlide.id} className="hero-campaign__mood">
                {activeSlide.mood}
              </span>
            </div>

            <div
              className="hero-campaign__controls"
              role="group"
              aria-label={copy.controls}
              onKeyDown={carousel.handleControlsKeyDown}
            >
              <button
                type="button"
                className="control-button control-button--previous"
                aria-label={copy.previous}
                onClick={carousel.previous}
              >
                <Icon name="chevron" />
              </button>
              <button
                type="button"
                className="control-button"
                aria-label={copy.next}
                onClick={carousel.next}
              >
                <Icon name="chevron" />
              </button>
              {!carousel.reducedMotion && (
                <button
                  type="button"
                  className="control-button"
                  aria-label={carousel.userPaused ? copy.play : copy.pause}
                  onClick={carousel.togglePaused}
                >
                  <Icon name={carousel.userPaused ? "play" : "pause"} />
                </button>
              )}
            </div>

            <p
              className="visually-hidden"
              aria-live="polite"
              aria-atomic="true"
            >
              {carousel.announcement}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
