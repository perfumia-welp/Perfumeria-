import { useI18n } from "@/i18n/i18nContext"
import type { Testimonial } from "@/types/content"
import "./TestimonialCard.css"

const MAX_RATING = 5

export default function TestimonialCard({
  testimonial,
}: {
  testimonial: Testimonial
}) {
  const { author, rating } = testimonial
  const { t } = useI18n()
  const stars = Array.from({ length: MAX_RATING }, (_, index) =>
    index < rating ? "★" : "☆",
  ).join(" ")

  return (
    <article className="testimonial-card">
      <span
        className="testimonial-card__rating"
        role="img"
        aria-label={t.home.testimonials.rating(rating, MAX_RATING)}
      >
        {stars}
      </span>
      <blockquote>{t.home.testimonials.quoted(testimonial.quote)}</blockquote>
      <span className="testimonial-card__divider" />
      <div className="testimonial-card__author">
        {author.avatar && (
          <img src={author.avatar.src} alt={author.avatar.alt} loading="lazy" />
        )}
        <div>
          <strong>{author.name}</strong>
          {author.role && <span>{author.role}</span>}
        </div>
      </div>
    </article>
  )
}
