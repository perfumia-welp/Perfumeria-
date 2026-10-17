import { useI18n } from "@/i18n/i18nContext"
import type { Product } from "@/types/catalog"
import { useWishlist } from "@/wishlist/wishlistContext"
import Icon from "../ui/Icon"
import "./WishlistButton.css"

/**
 * Save / remove a fragrance. "icon" is the heart on product imagery; "text"
 * adds a visible label (product page).
 */
export default function WishlistButton({
  product,
  variant = "icon",
  className,
}: {
  product: Product
  variant?: "icon" | "text"
  className?: string
}) {
  const { has, toggle } = useWishlist()
  const { t } = useI18n()
  const copy = t.product.wishlist
  const saved = has(product.id)
  const label = saved ? copy.remove : copy.save

  return (
    <button
      type="button"
      className={[
        "wishlist-button",
        `wishlist-button--${variant}`,
        saved && "is-saved",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={
        variant === "icon" ? copy.label(label, product.name) : undefined
      }
      onClick={() => toggle(product)}
    >
      <Icon name="heart" />
      {variant === "text" && (
        <span>{saved ? copy.removeVisible : copy.saveVisible}</span>
      )}
    </button>
  )
}
