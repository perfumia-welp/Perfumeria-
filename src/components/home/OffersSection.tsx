import { useBag } from "@/cart/bagContext"
import type { Product } from "@/types/catalog"
import type { NavigationItem, SectionIntro } from "@/types/content"
import ProductCard from "../product/ProductCard"
import { ProductSkeleton } from "../products/ProductGridSkeleton"
import Container from "../ui/Container"
import SectionHeader from "../ui/SectionHeader"
import TextLink from "../ui/TextLink"
import "./OffersSection.css"

/** The section shows at most this many offers (getFeaturedProducts). */
const OFFER_SLOTS = 4

export default function OffersSection({
  intro,
  products,
  pending,
}: {
  intro: SectionIntro & { cta: NavigationItem }
  products: Product[]
  /** The full catalogue, where offers are found, is still on its way. */
  pending: boolean
}) {
  const { addItem } = useBag()
  // Only real discounts are offers; with none, the section is left out. Until
  // the catalogue can say, its place is held so the page below it stays still.
  if (!products.length && !pending) return null
  const waiting = pending ? OFFER_SLOTS - products.length : 0

  return (
    <Container
      as="section"
      className="offers"
      id="products"
      aria-labelledby="offers-title"
      aria-busy={waiting > 0 || undefined}
    >
      <SectionHeader
        intro={intro}
        titleId="offers-title"
        action={<TextLink link={intro.cta} />}
      />
      <div className={`product-grid${waiting > 0 ? " product-skeletons" : ""}`}>
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            position={index + 1}
            onAddToBag={addItem}
          />
        ))}
        {Array.from({ length: Math.max(waiting, 0) }, (_, index) => (
          <div key={index} aria-hidden="true">
            <ProductSkeleton variant="editorial" />
          </div>
        ))}
      </div>
    </Container>
  )
}
