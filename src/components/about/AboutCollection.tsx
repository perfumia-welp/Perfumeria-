import type { AboutCollectionContent } from "@/types/content"
import AboutSentenceList from "./AboutSentenceList"
import "./AboutCollection.css"

export default function AboutCollection({
  content,
}: {
  content: AboutCollectionContent
}) {
  return (
    <section className="about-collection" aria-labelledby="collection-title">
      <div className="about-collection__inner">
        <div className="about-collection__figure" aria-hidden="true">
          <span className="about-collection__number">{content.figure}</span>
          <span className="about-collection__label">{content.figureLabel}</span>
        </div>
        <div className="about-collection__copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <h2 id="collection-title" className="about-heading">
            {content.title}
          </h2>
          {content.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>
      </div>
      <AboutSentenceList
        content={content.styles}
        className="about-collection__styles"
      />
    </section>
  )
}
