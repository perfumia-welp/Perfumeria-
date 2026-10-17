import { useBag } from "@/cart/bagContext"
import type { Product } from "@/types/catalog"
import type { NavigationItem, SectionIntro } from "@/types/content"
import ProductCard from "../product/ProductCard"
import Container from "../ui/Container"
import SectionHeader from "../ui/SectionHeader"
import TextLink from "../ui/TextLink"
import "./OffersSection.css"

export default function OffersSection({
  intro,
  products,
}: {
  intro: SectionIntro & { cta: NavigationItem }
  products: Product[]
}) {
  const { addItem } = useBag()
  // Only real discounts are offers; with none, the section is left out.
  if (!products.length) return null

  return (
    <Container
      as="section"
      className="offers"
      id="products"
      aria-labelledby="offers-title"
    >
      <SectionHeader
        intro={intro}
        titleId="offers-title"
        action={<TextLink link={intro.cta} />}
      />
      <div className="product-grid">
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            position={index + 1}
            onAddToBag={addItem}
          />
        ))}
      </div>
    </Container>
  )
}
