import { useBag } from "@/cart/bagContext"
import ProductCard from "@/components/product/ProductCard"
import Container from "@/components/ui/Container"
import PageIntro from "@/components/ui/PageIntro"
import TextLink from "@/components/ui/TextLink"
import { useI18n } from "@/i18n/i18nContext"
import { paths } from "@/router/paths"
import { useWishlist } from "@/wishlist/wishlistContext"
import "./ProductsPage.css"

/** Saved fragrances, shown with the catalogue's grid. Open to every visitor. */
export default function WishlistPage() {
  const { products } = useWishlist()
  const { addItem } = useBag()
  const { t } = useI18n()
  const copy = t.wishlist

  return (
    <>
      <PageIntro
        intro={copy.intro}
        meta={products.length > 0 && t.common.fragranceCount(products.length)}
      />

      <Container className="catalogue">
        {products.length ? (
          <ul className="catalogue__grid">
            {products.map((product, index) => (
              <li key={product.id}>
                <ProductCard
                  product={product}
                  position={index + 1}
                  onAddToBag={addItem}
                  variant="packshot"
                  headingLevel="h2"
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="catalogue__empty">
            <h2>{copy.empty.title}</h2>
            <p>{copy.empty.text}</p>
            <TextLink
              link={{ label: copy.empty.action, href: paths.products }}
            />
          </div>
        )}
      </Container>
    </>
  )
}
