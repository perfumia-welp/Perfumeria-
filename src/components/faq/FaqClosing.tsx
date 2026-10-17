import type { FaqContent } from "@/data/faq"
import AppLink from "../ui/AppLink"
import Container from "../ui/Container"
import Icon from "../ui/Icon"
import "./FaqClosing.css"

/** "Still Have Questions?": centred between hairlines, three actions. */
export default function FaqClosing({
  content,
}: {
  content: FaqContent["closing"]
}) {
  const { products, wholesale, contact } = content.actions
  return (
    <Container
      as="section"
      className="faq-closing"
      aria-labelledby="faq-closing-title"
    >
      <h2 id="faq-closing-title" className="faq-closing__title">
        {content.title}
      </h2>
      {content.lines.map((line) => (
        <p key={line} className="faq-closing__text">
          {line}
        </p>
      ))}
      <div className="faq-closing__actions">
        <AppLink className="button-primary" href={products.href}>
          <span>{products.text}</span>
          <Icon name="arrow" />
        </AppLink>
        <AppLink className="faq-closing__secondary" href={wholesale.href}>
          {wholesale.text}
        </AppLink>
        <AppLink className="faq-closing__secondary" href={contact.href}>
          {contact.text}
        </AppLink>
      </div>
    </Container>
  )
}
