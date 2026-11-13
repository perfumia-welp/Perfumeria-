import { useI18n } from "@/i18n/i18nContext"

/**
 * "FREE −EGP 599" under a bag or checkout line whose units the Buy 3
 * promotion made free. Screen readers hear the promotion's name first.
 */
export default function PromotionFreeNote({
  className,
  freeQuantity,
  quantity,
  discount,
}: {
  className: string
  freeQuantity: number
  quantity: number
  /** Formatted discount for this line ("EGP 599"). */
  discount: string
}) {
  const { t } = useI18n()
  const copy = t.cart.promotion
  return (
    <p className={`promotion-free ${className}`}>
      <span className="visually-hidden">{copy.name}: </span>
      <span className="promotion-free__badge">
        {copy.free(freeQuantity, quantity)}
      </span>{" "}
      <bdi className="promotion-free__amount">{copy.lineDiscount(discount)}</bdi>
    </p>
  )
}
