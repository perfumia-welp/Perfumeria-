import type { AboutQualityContent } from "@/types/content"
import Container from "../ui/Container"
import EditorialFigure from "../ui/EditorialFigure"
import "./AboutQuality.css"

export default function AboutQuality({
  content,
}: {
  content: AboutQualityContent
}) {
  return (
    <Container
      as="section"
      className="about-quality"
      aria-labelledby="quality-title"
    >
      <EditorialFigure
        visual={content.visual}
        sizes="(max-width: 767px) 100vw, 50vw"
        className="about-quality__visual"
      />
      <div className="about-quality__copy">
        <p className="eyebrow">{content.eyebrow}</p>
        <h2 id="quality-title" className="about-heading">
          {content.title}
        </h2>
        <p className="about-quality__statement">{content.statement}</p>
        {content.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
      </div>
    </Container>
  )
}
