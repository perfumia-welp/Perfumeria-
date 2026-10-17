import type { AboutInvitationContent } from "@/types/content"
import AppLink from "../ui/AppLink"
import Container from "../ui/Container"
import Icon from "../ui/Icon"
import "./AboutInvitation.css"

export default function AboutInvitation({
  content,
}: {
  content: AboutInvitationContent
}) {
  return (
    <Container
      as="section"
      className="about-invitation"
      aria-labelledby="invitation-title"
    >
      <h2 id="invitation-title" className="about-invitation__title">
        {content.title}
      </h2>
      <ul className="about-invitation__highlights">
        {content.highlights.map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>
      <p className="about-invitation__text">{content.text}</p>
      <p className="about-invitation__closing">{content.closing}</p>
      <div className="about-invitation__actions">
        <AppLink className="button-primary" href={content.primary.href}>
          <span>{content.primary.label}</span>
          <Icon name="arrow" />
        </AppLink>
        <AppLink
          className="about-invitation__secondary"
          href={content.secondary.href}
        >
          {content.secondary.label}
        </AppLink>
      </div>
    </Container>
  )
}
