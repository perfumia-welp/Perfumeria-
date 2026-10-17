import type { ReactNode } from "react"
import type { PageIntroContent } from "@/types/content"
import Container from "./Container"
import "./PageIntro.css"

interface PageIntroProps {
  intro: PageIntroContent
  /** Right-aligned detail such as "8 Fragrances". */
  meta?: ReactNode
  /** Extra content under the lead, e.g. a back link. */
  children?: ReactNode
}

/** Editorial page opening: eyebrow, display heading, lead and an optional meta value. */
export default function PageIntro({ intro, meta, children }: PageIntroProps) {
  return (
    <Container className="page-intro">
      <div className="page-intro__copy">
        <p className="eyebrow">{intro.eyebrow}</p>
        <h1>{intro.title}</h1>
        {intro.lead && <p className="page-intro__lead">{intro.lead}</p>}
        {children}
      </div>
      {meta && <p className="page-intro__meta">{meta}</p>}
    </Container>
  )
}
