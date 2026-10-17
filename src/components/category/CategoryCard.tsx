import type { Category } from "@/types/content"
import AppLink from "../ui/AppLink"
import Icon from "../ui/Icon"
import "./CategoryCard.css"

export default function CategoryCard({
  category,
  sizes,
  featured = false,
}: {
  category: Category
  sizes: string
  featured?: boolean
}) {
  return (
    // The visible label names the link, so the photograph is decorative here.
    <AppLink
      className={`category-card${featured ? " category-card--featured" : ""}`}
      href={category.href}
    >
      <img
        src={category.image.src}
        srcSet={category.image.srcSet}
        sizes={sizes}
        alt=""
        loading="lazy"
      />
      <span className="category-card__shade" />
      <span className="category-card__label">
        <small>{category.label}</small>
        <strong>{category.name}</strong>
        <span>
          {category.ctaLabel} <Icon name="arrow" />
        </span>
      </span>
    </AppLink>
  )
}
