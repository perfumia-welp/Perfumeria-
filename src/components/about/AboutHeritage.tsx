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
      <div className="about-heritage__year" aria-hidden="true">
        <span>{content.year}</span>
      </div>
      <div className="about-heritage__copy">
        <p className="eyebrow">{content.eyebrow}</p>
        <h2 id="heritage-title" className="about-heading">
          {content.title}
        </h2>
        {content.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
      </div>
    </Container>
  )
}
