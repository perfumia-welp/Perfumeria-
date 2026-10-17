import type { AboutStoryContent } from "@/types/content"
import Container from "../ui/Container"
import EditorialFigure from "../ui/EditorialFigure"
import "./AboutStory.css"

export default function AboutStory({
  content,
}: {
  content: AboutStoryContent
}) {
  return (
    <Container
      as="section"
      className="about-story"
      aria-labelledby="story-title"
    >
      <div className="about-story__copy">
        <p className="eyebrow">{content.eyebrow}</p>
        <h2 id="story-title" className="about-heading">
          {content.title}
        </h2>
        <span className="about-story__rule" aria-hidden="true" />
        {content.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
      </div>
      <EditorialFigure
        visual={content.visual}
        sizes="(max-width: 767px) 100vw, 55vw"
        className="about-story__visual"
      />
    </Container>
  )
}
