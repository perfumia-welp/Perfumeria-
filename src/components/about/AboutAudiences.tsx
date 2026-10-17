import type { AboutAudiencesContent } from "@/types/content"
import Container from "../ui/Container"
import "./AboutAudiences.css"

export default function AboutAudiences({
  content,
}: {
  content: AboutAudiencesContent
}) {
  return (
    <Container
      as="section"
      className="about-audiences"
      aria-labelledby="audiences-title"
    >
      <div className="about-audiences__header">
        <p className="eyebrow">{content.eyebrow}</p>
        <h2 id="audiences-title" className="about-heading">
          {content.title}
        </h2>
        <p className="about-audiences__intro">{content.intro}</p>
      </div>
      <p className="about-audiences__lead">{content.lead}</p>
      <ul className="about-audiences__groups">
        {content.groups.map((group) => (
          <li key={group.label}>
            <h3>{group.label}</h3>
            <p>{group.text}</p>
          </li>
        ))}
      </ul>
      <div className="about-audiences__close">
        <p className="about-audiences__goal">{content.close}</p>
        <p>{content.commitment}</p>
      </div>
    </Container>
  )
}
