import type { AboutValuesContent } from "@/types/content"
import Container from "../ui/Container"
import Icon from "../ui/Icon"
import "./AboutValues.css"

const pad = (value: number) => String(value).padStart(2, "0")

export default function AboutValues({
  content,
}: {
  content: AboutValuesContent
}) {
  return (
    <Container
      as="section"
      className="about-values"
      aria-labelledby="values-title"
    >
      <p className="eyebrow">{content.eyebrow}</p>
      <h2 id="values-title" className="about-heading about-values__title">
        {content.title}
      </h2>
      <ul className="about-values__grid">
        {content.values.map((value, index) => (
          <li key={value.title}>
            <div className="about-values__meta" aria-hidden="true">
              <Icon name={value.icon} />
              <span>{pad(index + 1)}</span>
            </div>
            <h3>{value.title}</h3>
            <p>{value.text}</p>
          </li>
        ))}
      </ul>
    </Container>
  )
}
