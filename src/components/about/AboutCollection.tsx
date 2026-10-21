import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
} from "react"
import usePrefersReducedMotion from "@/hooks/usePrefersReducedMotion"
import type { AboutCollectionContent } from "@/types/content"
import Icon from "../ui/Icon"
import "./AboutCollection.css"

const pad = (value: number) => String(value).padStart(2, "0")

/**
 * Pauses while the pointer rests on, or keyboard focus is in, the element
 * the handlers are spread on. A mouse click does not count as keyboard focus.
 */
function usePauseOnInteraction() {
  const [hovered, setHovered] = useState(false)
  const [keyboardFocused, setKeyboardFocused] = useState(false)
  return {
    interacting: hovered || keyboardFocused,
    handlers: {
      onPointerEnter: (event: PointerEvent<HTMLElement>) =>
        event.pointerType === "mouse" && setHovered(true),
      onPointerLeave: () => setHovered(false),
      onFocus: (event: FocusEvent<HTMLElement>) =>
        setKeyboardFocused(event.target.matches(":focus-visible")),
      onBlur: (event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setKeyboardFocused(false)
      },
    },
  }
}

/*
 * The collection: a company fact (1997, 450+, Egypt, European + Eastern)
 * and the active fragrance style beside the owner's text, then the four
 * styles as a hairline selector. Fact, style, progress and selector change
 * together; the selector numbers are navigation only. Only the owner's words are shown: the display
 * repeats the selected style's name, nothing is added to it.
 *
 * Autoplay follows the hero carousel: a CSS progress line on the active
 * style (4.5 s) advances it on `animationend`, so pausing the animation
 * pauses the rotation. It pauses on hover or keyboard focus, off screen and
 * by the pause button; a pick restarts it. Under reduced motion it never
 * starts and the styles change only when picked.
 */
export default function AboutCollection({
  content,
}: {
  content: AboutCollectionContent
}) {
  const { styles, controls } = content
  const total = styles.items.length
  const reducedMotion = usePrefersReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  // Bumped on every pick so the progress line restarts from zero.
  const [cycle, setCycle] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [inView, setInView] = useState(false)
  const display = usePauseOnInteraction()
  const selector = usePauseOnInteraction()

  const autoplay = !reducedMotion && !userPaused && total > 1
  const running =
    autoplay && inView && !display.interacting && !selector.interacting

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry.isIntersecting),
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  const pick = (index: number) => {
    setActive(index)
    setCycle((value) => value + 1)
  }

  return (
    <section
      ref={sectionRef}
      className="about-collection"
      aria-labelledby="collection-title"
    >
      <div className="about-collection__inner">
        <div className="about-collection__aside">
          {/* All four facts stay in the reading order; only the active one is shown. */}
          <ul className="about-collection__proofs" role="list">
            {content.proofs.map((proof, index) => (
              <li
                key={proof.value}
                className="about-collection__proof"
                data-active={index === active % content.proofs.length || undefined}
              >
                <span
                  className="about-collection__proof-value"
                  data-kind={/^d/.test(proof.value) ? "figure" : "word"}
                  style={{ "--letters": proof.value.length } as CSSProperties}
                >
                  {proof.value}
                </span>
                <span className="about-collection__proof-label">
                  {proof.label}
                </span>
              </li>
            ))}
          </ul>

          <div className="about-collection__display" {...display.handlers}>
            {styles.lead && (
              <p className="about-collection__lead" aria-hidden="true">
                {styles.lead}
              </p>
            )}
            <div className="about-collection__names" aria-hidden="true">
              {styles.items.map((item, index) => (
                <span
                  key={item}
                  className="about-collection__name"
                  data-active={index === active || undefined}
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="about-collection__meta">
              {/* Mirrors the active selector's progress line, in step with it. */}
              {autoplay && (
                <span className="about-collection__track" aria-hidden="true">
                  <span
                    key={`${active}-${cycle}`}
                    className="about-collection__progress"
                    style={{ animationPlayState: running ? "running" : "paused" }}
                  />
                </span>
              )}
              {!reducedMotion && total > 1 && (
                <button
                  type="button"
                  className="about-collection__toggle"
                  aria-label={userPaused ? controls.play : controls.pause}
                  onClick={() => {
                    setUserPaused((paused) => !paused)
                    setCycle((value) => value + 1)
                  }}
                >
                  <Icon name={userPaused ? "play" : "pause"} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="about-collection__copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <h2 id="collection-title" className="about-heading">
            {content.title}
          </h2>
          {content.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
          {/* Supporting figure; the heading already states it for readers. */}
          {content.figure && (
            <p className="about-collection__figure" aria-hidden="true">
              <span className="about-collection__number">{content.figure}</span>
              <span className="about-collection__label">
                {content.figureLabel}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* The owner's sentence in reading order: lead-in, the styles, close. */}
      <div className="about-styles">
        {styles.lead && <p className="visually-hidden">{styles.lead}</p>}
        <ol
          className={`about-styles__list${autoplay ? " about-styles__list--autoplay" : ""}`}
          style={{ "--styles": total } as CSSProperties}
          {...selector.handlers}
        >
          {styles.items.map((item, index) => (
            <li key={item}>
              <button
                type="button"
                className="about-styles__option"
                aria-pressed={index === active}
                onClick={() => pick(index)}
              >
                <span className="about-styles__number" aria-hidden="true">
                  {pad(index + 1)}
                </span>
                <span className="about-styles__name">{item}</span>
                {autoplay && index === active && (
                  <span
                    key={`${active}-${cycle}`}
                    className="about-styles__progress"
                    aria-hidden="true"
                    style={{ animationPlayState: running ? "running" : "paused" }}
                    onAnimationEnd={() => setActive((active + 1) % total)}
                  />
                )}
              </button>
            </li>
          ))}
        </ol>
        {styles.close && <p className="about-styles__close">{styles.close}</p>}
      </div>
    </section>
  )
}
