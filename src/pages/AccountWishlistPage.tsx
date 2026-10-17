import { useBag } from "@/cart/bagContext"
import ProductCard from "@/components/product/ProductCard"
import TextLink from "@/components/ui/TextLink"
import { useI18n } from "@/i18n/i18nContext"
import { paths } from "@/router/paths"
import { useWishlist } from "@/wishlist/wishlistContext"
import "./ProductsPage.css"

export default function AccountWishlistPage() {
  const { products } = useWishlist()
  const { addItem } = useBag()
  const { t } = useI18n()
  return (
    <>
      <p className="eyebrow">{t.account.eyebrow}</p>
      <h2 className="account-content__title account-content__title--compact">
        {t.account.nav.wishlist}
      </h2>
      <p className="account-preview-note account-preview-note--page">
        {t.account.wishlistNote}
      </p>
      {products.length ? (
        <ul className="catalogue__grid account-wishlist-grid">
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
          <h2>{t.wishlist.empty.title}</h2>
          <p>{t.wishlist.empty.text}</p>
          <TextLink
            link={{ label: t.wishlist.empty.action, href: paths.products }}
          />
        </div>
      )}
    </>
  )
}
