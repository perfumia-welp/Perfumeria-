import type { Category, CategorySupport, SectionIntro } from "@/types/content"
import CategoryCard from "../category/CategoryCard"
import Container from "../ui/Container"
import SectionHeader from "../ui/SectionHeader"
import TextLink from "../ui/TextLink"
import "./CategorySection.css"

export default function CategorySection({
  intro,
  featured,
  secondary,
  support,
}: {
  intro: SectionIntro
  featured: Category
  secondary: Category[]
  support: CategorySupport
}) {
  return (
    <Container
      as="section"
      className="categories"
      aria-labelledby="categories-title"
    >
      <SectionHeader intro={intro} titleId="categories-title" />
      <div className="categories__grid">
        <div className="categories__featured">
          <CategoryCard
            category={featured}
            featured
            sizes="(max-width: 767px) 100vw, 60vw"
          />
          <div className="categories__support">
            <p className="eyebrow">{support.eyebrow}</p>
            <h3>{support.title}</h3>
            <p>{support.description}</p>
            <TextLink link={support.cta} />
          </div>
        </div>
        <div className="categories__column">
          {secondary.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              sizes="(max-width: 767px) 100vw, 36vw"
            />
          ))}
        </div>
      </div>
    </Container>
  )
}
