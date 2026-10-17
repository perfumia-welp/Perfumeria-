import type { AboutWhyContent } from "@/types/content"
import EditorialFigure from "../ui/EditorialFigure"
import "./AboutWhy.css"

const pad = (value: number) => String(value).padStart(2, "0")

export default function AboutWhy({ content }: { content: AboutWhyContent }) {
  return (
    <section className="about-why" aria-labelledby="why-title">
      <div className="about-why__inner">
        <EditorialFigure
          visual={content.visual}
          sizes="(max-width: 767px) 100vw, 45vw"
          className="about-why__visual"
        />
        <div className="about-why__copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <h2 id="why-title" className="about-heading">
            {content.title}
          </h2>
          <p className="about-why__intro">{content.intro}</p>
          <ol className="about-why__reasons">
            {content.reasons.map((reason, index) => (
              <li key={reason.title}>
                <span aria-hidden="true">{pad(index + 1)}</span>
                <div>
                  <h3>{reason.title}</h3>
                  <p>{reason.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
