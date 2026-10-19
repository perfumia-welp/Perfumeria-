import type { AboutHeritageContent } from "@/types/content"
import Container from "../ui/Container"
import "./AboutHeritage.css"

export default function AboutHeritage({
  content,
}: {
  content: AboutHeritageContent
}) {
  return (
    <Container
      as="section"
      className="about-heritage"
      aria-labelledby="heritage-title"
    >
      <div className="about-heritage__copy">
        <p className="eyebrow">{content.eyebrow}</p>
        <h2 id="heritage-title" className="about-heading">
          {content.title}
        </h2>
        {content.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
      </div>

      {/* A visual summary of the story above, so it is hidden from readers. */}
      <div className="about-heritage__timeline" aria-hidden="true">
        <div className="about-heritage__stop about-heritage__stop--anchor">
          <span className="about-heritage__label">{content.yearLabel}</span>
          <span className="about-heritage__year">{content.year}</span>
          <span className="about-heritage__caption">{content.yearCaption}</span>
        </div>
        {content.milestones.map((milestone) => (
          <div key={milestone.label} className="about-heritage__stop">
            <span className="about-heritage__label">{milestone.label}</span>
            <span className="about-heritage__text">{milestone.text}</span>
          </div>
        ))}
      </div>
    </Container>
  )
}
