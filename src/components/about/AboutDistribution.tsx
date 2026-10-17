import type { AboutDistributionContent } from "@/types/content"
import EditorialFigure from "../ui/EditorialFigure"
import AboutSentenceList from "./AboutSentenceList"
import "./AboutDistribution.css"

export default function AboutDistribution({
  content,
}: {
  content: AboutDistributionContent
}) {
  return (
    <section
      className="about-distribution"
      aria-labelledby="distribution-title"
    >
      <div className="about-distribution__inner">
        <div className="about-distribution__copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <h2 id="distribution-title" className="about-heading">
            {content.title}
          </h2>
          {content.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
          <AboutSentenceList
            content={content.pillars}
            className="about-distribution__pillars"
          />
        </div>
        <EditorialFigure
          visual={content.visual}
          sizes="(max-width: 767px) 100vw, 42vw"
          className="about-distribution__visual"
        />
      </div>
    </section>
  )
}
