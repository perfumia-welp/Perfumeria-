import {
  useEffect,
  useMemo,
  type CSSProperties,
  type KeyboardEvent,
} from "react"
import { useI18n } from "@/i18n/i18nContext"
import { productPath } from "@/router/paths"
import { useCatalogState } from "@/hooks/useCatalogState"
import { getHeroArt, getHeroProduct, productSource } from "@/services/catalog"
import type { HeroContent } from "@/types/content"
import AppLink from "../ui/AppLink"
import Icon from "../ui/Icon"
import useHeroStage from "./useHeroStage"
import "./HeroPerfume.css"

/*
 * TEMPORARY (hero comparison): "Hero C", three scroll-stepped perfume slides.
 *
 * One bottle per slide, centred on the stage, each with its own copy, light
 * and backdrop. Scrolling (or swiping) on the hero moves from one perfume to
 * the next; see useHeroStage.ts for the interaction, which is adapted from
 * the Crystal Asfour hero.
 *
 * There is no WebGL. The bottles are flat transparent cut-outs (the mock
 * packshots, or a live product's `cutout`, never its styled photo); the depth comes from how a bottle travels between slides (it
 * rises out towards the viewer, blurring, while the next one comes up from
 * further back) and from light confined to the bottle's own pixels.
 *
 * All words come from the catalogue (name, family, notes, description), so
 * each slide describes the product it links to, in English and Arabic.
 */

type Tone = "blush" | "gold" | "night"

/** A sparkle on the bottle: x %, y % and size % of the bottle image box. */
type Glint = [x: number, y: number, size: number]

interface StageBottle {
  productId: string
  /** Backdrop, light and text colours for the slide (see HeroPerfume.css). */
  tone: Tone
  /** Width / height of the packshot. */
  aspect: number
  /** Which of the product's character words is set large behind the bottle. */
  word: number
  glints: Glint[]
}

const MOCK_BOTTLES: StageBottle[] = [
  {
    productId: "velvet-iris",
    tone: "blush",
    aspect: 561 / 800,
    word: 0,
    glints: [
      [49, 3, 16],
      [33, 37, 12],
      [90, 61, 13],
    ],
  },
  {
    productId: "amber-reverie",
    tone: "gold",
    aspect: 648 / 800,
    word: 2,
    glints: [
      [41, 9, 15],
      [89, 34, 12],
      [45, 62, 11],
    ],
  },
  {
    productId: "quiet-oud",
    tone: "night",
    aspect: 466 / 800,
    word: 0,
    glints: [
      [45, 7, 20],
      [84, 24, 12],
    ],
  },
]

/*
 * Live company products with a cut-out in config/heroCutouts.ts. The aspect
 * comes from the cut-out itself; glints are left out until placed by eye.
 */
const LIVE_BOTTLES: StageBottle[] = [
  { productId: "14097", tone: "blush", aspect: 0, word: 0, glints: [] },
  { productId: "14075", tone: "gold", aspect: 0, word: 0, glints: [] },
  { productId: "13977", tone: "night", aspect: 0, word: 0, glints: [] },
]

const BOTTLES = productSource === "live" ? LIVE_BOTTLES : MOCK_BOTTLES

const pad = (value: number) => String(value).padStart(2, "0")

export default function HeroPerfume({ content }: { content: HeroContent }) {
  const { t, locale, dir } = useI18n()
  const { version: catalogVersion } = useCatalogState()
  const copy = t.home.carousel

  const slides = useMemo(
    () =>
      BOTTLES.flatMap((bottle) => {
        const product = getHeroProduct(bottle.productId, locale)
        const art = product && getHeroArt(product)
        if (!product || !art) return []
        const aspect = "aspect" in art ? art.aspect : bottle.aspect
        return [{ ...bottle, aspect, art, product }]
      }),
    [locale, catalogVersion],
  )
  const total = slides.length
  const { active, previous, moved, reducedMotion, sectionRef, goTo } =
    useHeroStage(total)
  const forward = dir === "rtl" ? -1 : 1

  // Pointer parallax: mouse only, and never under reduced motion.
  useEffect(() => {
    const section = sectionRef.current
    if (!section || reducedMotion) return
    if (!window.matchMedia("(pointer: fine)").matches) return
    let frame = 0
    const set = (x: number, y: number) => {
      section.style.setProperty("--px", x.toFixed(3))
      section.style.setProperty("--py", y.toFixed(3))
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const rect = section.getBoundingClientRect()
        set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          ((event.clientY - rect.top) / rect.height) * 2 - 1,
        )
      })
    }
    const onLeave = () => {
      cancelAnimationFrame(frame)
      set(0, 0)
    }
    section.addEventListener("pointermove", onMove)
    section.addEventListener("pointerleave", onLeave)
    return () => {
      section.removeEventListener("pointermove", onMove)
      section.removeEventListener("pointerleave", onLeave)
      cancelAnimationFrame(frame)
      section.style.removeProperty("--px")
      section.style.removeProperty("--py")
    }
  }, [sectionRef, reducedMotion])

  if (total === 0) return null

  /** Where a slide is in the sequence: already passed, on stage, or still to come. */
  const stateOf = (index: number) =>
    index === active ? "active" : index < active ? "past" : "next"

  const handleIndicatorKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft") goTo(active - forward)
    else if (event.key === "ArrowRight") goTo(active + forward)
    else if (event.key === "Home") goTo(0)
    else if (event.key === "End") goTo(total - 1)
    else return
    event.preventDefault()
  }

  return (
    <section
      ref={sectionRef}
      className="hero-stage"
      data-tone={slides[active].tone}
      aria-roledescription="carousel"
      aria-labelledby="hero-title"
    >
      <h1 id="hero-title" className="visually-hidden">
        {content.heading.lines.join(" ")}
      </h1>

      {/* Layer 1: one backdrop and pool of light per slide. */}
      <div className="hero-stage__backdrops" aria-hidden="true">
        {slides.map((slide, index) => (
          <div
            key={slide.productId}
            className={`hero-stage__backdrop${
              index === active
                ? " is-active"
                : index === previous
                  ? " is-exiting"
                  : ""
            }`}
            data-tone={slide.tone}
          >
            <span className="hero-stage__halo" />
          </div>
        ))}
      </div>

      {/* Layer 2: a large serif word behind the bottle. */}
      <div className="hero-stage__words" aria-hidden="true">
        {slides.map((slide, index) => (
          <span
            key={slide.productId}
            className="hero-stage__word"
            data-state={stateOf(index)}
            data-tone={slide.tone}
          >
            {slide.product.story?.character[slide.word] ??
              (slide.product.family ? t.catalog.families[slide.product.family] : slide.product.fragranceFamily ?? "")}
          </span>
        ))}
      </div>

      {/* Layer 3: the bottles. Only the active one is visible once settled. */}
      <div className="hero-stage__objects" aria-hidden="true">
        {slides.map((slide, index) => {
          const { src } = slide.art
          return (
            <div
              key={slide.productId}
              className="hero-stage__object"
              data-state={stateOf(index)}
              data-tone={slide.tone}
              style={
                {
                  "--art": `url("${src}")`,
                  "--aspect": slide.aspect,
                } as CSSProperties
              }
            >
              {/* Each wrapper owns one motion, so they never fight over `transform`. */}
              <div className="hero-stage__travel">
                <div className="hero-stage__shift">
                  <span className="hero-stage__shadow" />
                  <img
                    className="hero-stage__reflection"
                    src={src}
                    alt=""
                    draggable={false}
                  />
                  <div className="hero-stage__float">
                    <div className="hero-stage__tilt">
                      <img
                        className="hero-stage__art"
                        src={src}
                        alt=""
                        draggable={false}
                        fetchPriority={index === 0 ? "high" : "low"}
                      />
                      <span className="hero-stage__sheen">
                        <i />
                      </span>
                      {slide.glints.map(([x, y, size], glint) => (
                        <span
                          key={glint}
                          className="hero-stage__glint"
                          style={{
                            animationDelay: `${(1.6 + glint * 1.7).toFixed(1)}s`,
                            left: `${x}%`,
                            top: `${y}%`,
                            width: `${size}%`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Layer 4: copy. Slides share one grid cell, so nothing shifts between them. */}
      <div className="hero-stage__content">
        {slides.map((slide, index) => {
          const { product } = slide
          const isActive = index === active
          const family = (product.family ? t.catalog.families[product.family] : product.fragranceFamily ?? "")
          const composition = product.story?.composition
          return (
            <div
              key={slide.productId}
              className={`page-container hero-stage__slide${
                isActive ? " is-active" : ""
              }`}
              role="group"
              aria-roledescription="slide"
              aria-label={copy.slide(index + 1, total, product.name)}
              aria-hidden={!isActive}
              inert={!isActive}
              data-tone={slide.tone}
            >
              <div className="hero-stage__copy">
                <p className="hero-stage__family">
                  <span>{pad(index + 1)}</span>
                  {family}
                </p>
                <h2 className="hero-stage__name">{product.name}</h2>
                <p className="hero-stage__keynotes">
                  {product.notes.join(" · ")}
                </p>
                {product.story && (
                  <p className="hero-stage__description">
                    {product.story.description}
                  </p>
                )}
                <AppLink
                  className="button-primary hero-stage__cta"
                  href={productPath(product.slug)}
                  aria-label={`${t.home.categories.cta}: ${product.name}`}
                >
                  {t.home.categories.cta} <Icon name="arrow" />
                </AppLink>
              </div>

              {composition && (
                <dl className="hero-stage__notes">
                  {(["top", "heart", "base"] as const).map((stage) => (
                    <div key={stage}>
                      <dt>{t.product.composition[stage]}</dt>
                      <dd>{composition[stage].join(t.common.listSeparator)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )
        })}
      </div>

      {total > 1 && (
        <>
          <div
            className="hero-stage__indicator"
            role="group"
            aria-label={copy.controls}
            onKeyDown={handleIndicatorKeyDown}
          >
            {slides.map((slide, index) => (
              <button
                key={slide.productId}
                type="button"
                className="hero-stage__step"
                aria-current={index === active ? "step" : undefined}
                aria-label={copy.slide(index + 1, total, slide.product.name)}
                onClick={() => goTo(index)}
              >
                <span>{pad(index + 1)}</span>
                {index < total - 1 && (
                  <i
                    className="hero-stage__track"
                    style={
                      {
                        "--fill":
                          active > index ? 1 : active === index ? 0.32 : 0,
                      } as CSSProperties
                    }
                  />
                )}
              </button>
            ))}
          </div>

          {/* A quiet cue that the hero responds to scrolling. */}
          <span className="hero-stage__cue" aria-hidden="true" />

          <p className="visually-hidden" aria-live="polite" aria-atomic="true">
            {/* Slide changes are announced, but not the slide the page opens on. */}
            {moved
              ? copy.announcement(
                  active + 1,
                  total,
                  slides[active].product.name,
                )
              : ""}
          </p>
        </>
      )}
    </section>
  )
}
