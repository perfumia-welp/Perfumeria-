import type { AboutHeroContent } from "@/types/content"
import EditorialFigure from "../ui/EditorialFigure"
import "./AboutHero.css"

export default function AboutHero({ content }: { content: AboutHeroContent }) {
  return (
    <section className="about-hero" aria-labelledby="about-title">
      <div className="about-hero__copy">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1 id="about-title">{content.title}</h1>
        <p className="about-hero__lead">{content.lead}</p>
        <p className="about-hero__signature" aria-hidden="true">
          {content.signature.map((part, index) => (
            <span key={part}>
              {index > 0 && <i />}
              {part}
            </span>
          ))}
        </p>
      </div>
      <EditorialFigure
        visual={content.visual}
        sizes="(max-width: 767px) 100vw, 54vw"
        className="about-hero__visual"
        priority
      />
    </section>
  )
}
