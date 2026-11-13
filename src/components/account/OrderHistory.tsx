import { useState } from "react"
import type { RemoteData } from "@/hooks/useRemoteData"
import { useI18n } from "@/i18n/i18nContext"
import { formatDate } from "@/lib/formatDate"
import { formatPrice } from "@/lib/formatPrice"
import type { OrderHistoryEntry } from "@/types/account"
import {
  AccountEmptyState,
  AccountLoadError,
  AccountLoading,
  AccountSection,
  AccountTextButton,
  ExploreLink,
} from "./AccountSections"

/** Orders shown before "View All Orders". */
const VISIBLE_ORDERS = 3

/**
 * The customer's order requests from Supabase, newest first. The status is
 * the request status only ("Awaiting store confirmation"): the store
 * confirms every order personally and no fulfilment status exists yet.
 */
export default function OrderHistory({
  orders,
  onRetry,
  showAll: alwaysShowAll = false,
}: {
  orders: RemoteData<OrderHistoryEntry[]>
  onRetry: () => void
  showAll?: boolean
}) {
  const { t, locale } = useI18n()
  const copy = t.account.orders
  const [showAll, setShowAll] = useState(false)
  const list = orders.status === "ready" ? orders.data : []
  const shown = alwaysShowAll || showAll ? list : list.slice(0, VISIBLE_ORDERS)
  /** "75 ml" → "75 مل" in Arabic; product names stay as written, in Arabic
   * only when the order kept an approved Arabic name. */
  const size = (value: string) =>
    value.replace(/ ?ml$/i, ` ${t.common.millilitres}`)

  return (
    <AccountSection
      id="account-orders"
      title={copy.title}
      action={
        !alwaysShowAll &&
        list.length > VISIBLE_ORDERS && (
          <AccountTextButton
            label={showAll ? copy.showFewer : copy.viewAll(list.length)}
            expanded={showAll}
            onClick={() => setShowAll((value) => !value)}
          />
        )
      }
    >
      {orders.status === "loading" && <AccountLoading />}
      {orders.status === "error" && <AccountLoadError onRetry={onRetry} />}
      {orders.status === "ready" &&
        (list.length ? (
          <ul className="order-list">
            {shown.map((order) => (
              <li key={order.id}>
                <div>
                  <p className="order-list__number">
                    <span dir="ltr">{order.reference}</span>
                  </p>
                  <p className="order-list__date">
                    <span className="visually-hidden">{copy.placed}</span>
                    {formatDate(order.placedOn, locale)}
                  </p>
                </div>
                <p className={`order-list__status is-${order.status}`}>
                  {copy.status[order.status]}
                </p>
                <p className="order-list__total">
                  <span className="visually-hidden">{copy.total}</span>
                  {formatPrice(order.total, order.currency, locale)}
                </p>
                <ul className="order-list__items" aria-label={copy.items}>
                  {order.items.map((item) => (
                    <li key={item.position}>
                      <span>
                        <bdi>
                          {locale === "ar" && item.nameAr
                            ? item.nameAr
                            : item.name}
                        </bdi>
                        {item.size && ` · ${size(item.size)}`}
                      </span>
                      <span className="order-list__quantity">
                        <bdi>
                          {formatPrice(item.unitPrice, order.currency, locale)}
                        </bdi>{" "}
                        <span aria-hidden="true">
                          {copy.quantity(item.quantity)}
                        </span>
                        <span className="visually-hidden">
                          {copy.quantityLabel(item.quantity)}
                        </span>
                      </span>
                    </li>
                  ))}
                  {order.promotionDiscount > 0 && (
                    <li className="order-list__promotion">
                      <span>{t.cart.promotion.name}</span>
                      <bdi className="order-list__quantity">
                        {t.cart.promotion.lineDiscount(
                          formatPrice(
                            order.promotionDiscount,
                            order.currency,
                            locale,
                          ),
                        )}
                      </bdi>
                    </li>
                  )}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <AccountEmptyState
            title={copy.emptyTitle}
            text={copy.emptyText}
            action={<ExploreLink />}
          />
        ))}
    </AccountSection>
  )
}
