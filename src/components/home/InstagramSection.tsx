import type { InstagramContent } from "@/types/content"
import Container from "../ui/Container"
import Icon from "../ui/Icon"
import "./InstagramSection.css"

/*
 * "Follow us on Instagram": curated previews that all lead to the company's
 * Instagram profile (content.cta.href), opened in a new tab. Nothing is
 * loaded from Instagram; the previews are local images listed in
 * data/home.ts, where they can be swapped for real Reel thumbnails.
 */
export default function InstagramSection({
  content,
}: {
  content: InstagramContent
}) {
  const profile = {
    href: content.cta.href,
    target: "_blank",
    rel: "noopener noreferrer",
  }

  return (
    <section className="instagram" aria-labelledby="instagram-title">
      <Container className="instagram__intro">
        {/* The handle is Latin text: kept left to right on Arabic pages. */}
        <p className="eyebrow" dir="ltr">
          {content.handle}
        </p>
        <h2 id="instagram-title" className="instagram__title">
          {content.title}
        </h2>
        <p className="instagram__description">{content.description}</p>
      </Container>

      <ul className="instagram__reels">
        {content.posts.map((post) => (
          <li key={post.id}>
            <a
              {...profile}
              className="instagram__reel"
              aria-label={`${post.label}: ${content.viewLabel} (${content.newTabLabel})`}
            >
              <img
                src={post.image.src}
                alt={post.image.alt}
                width={800}
                height={1200}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              <span className="instagram__badge" aria-hidden="true">
                <Icon name="reel" />
              </span>
              <span className="instagram__caption" aria-hidden="true">
                <strong>{post.label}</strong>
                <span className="instagram__view">
                  {content.viewLabel} <Icon name="arrow" />
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <Container className="instagram__action">
        <a {...profile} className="button-primary instagram__cta">
          <Icon name="instagram" />
          {content.cta.label}
          <span className="visually-hidden"> ({content.newTabLabel})</span>
        </a>
      </Container>
    </section>
  )
}
