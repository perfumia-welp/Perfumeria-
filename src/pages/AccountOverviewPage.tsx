import { useI18n } from "@/i18n/i18nContext"
import { formatDate } from "@/lib/formatDate"
import { formatPrice } from "@/lib/formatPrice"
import { paths } from "@/router/paths"
import { useWishlist } from "@/wishlist/wishlistContext"
import {
  AccountEmptyState,
  AccountLoadError,
  AccountLoading,
  AccountSection,
  ExploreLink,
  WishlistPreview,
} from "@/components/account/AccountSections"
import TextLink from "@/components/ui/TextLink"
import { useAccountData } from "@/components/account/AccountContext"

export default function AccountOverviewPage() {
  const { t, locale } = useI18n()
  const data = useAccountData()
  const { products } = useWishlist()
  const orders = data.orders.state
  const addresses = data.addresses.state
  const latest = orders.status === "ready" ? orders.data.slice(0, 2) : []
  const defaultAddress =
    addresses.status === "ready"
      ? (addresses.data.find((address) => address.isDefault) ??
        addresses.data[0])
      : undefined
  const profile =
    data.profile.state.status === "ready" ? data.profile.state.data : null
  const name = [
    profile?.firstName || data.fallback.firstName,
    profile?.lastName || data.fallback.lastName,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <>
      <p className="eyebrow">{t.account.eyebrow}</p>
      <h2 className="account-content__title">{t.account.title}</h2>
      <div className="account-overview-grid">
        <AccountSection
          id="account-orders"
          title={t.account.orders.title}
          action={
            <TextLink
              link={{
                label: t.account.orders.viewAllLabel,
                href: paths.accountOrders,
              }}
            />
          }
        >
          {orders.status === "loading" && <AccountLoading />}
          {orders.status === "error" && (
            <AccountLoadError onRetry={data.orders.reload} />
          )}
          {orders.status === "ready" &&
            (latest.length ? (
              <ul className="overview-orders">
                {latest.map((order) => (
                  <li key={order.id}>
                    <span>
                      <bdi dir="ltr">{order.reference}</bdi>
                      <small>{formatDate(order.placedOn, locale)}</small>
                    </span>
                    <strong>
                      {formatPrice(order.subtotal, order.currency, locale)}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <AccountEmptyState
                title={t.account.orders.emptyTitle}
                text={t.account.orders.emptyText}
                action={<ExploreLink />}
              />
            ))}
        </AccountSection>

        <WishlistPreview products={products} />

        <AccountSection
          id="account-addresses"
          title={t.account.addresses.title}
          action={
            <TextLink
              link={{
                label: t.account.addresses.manage,
                href: paths.accountAddresses,
              }}
            />
          }
        >
          {addresses.status === "loading" && <AccountLoading />}
          {addresses.status === "error" && (
            <AccountLoadError onRetry={data.addresses.reload} />
          )}
          {addresses.status === "ready" &&
            (defaultAddress ? (
              <address className="saved-address overview-address">
                <span>{defaultAddress.fullName}</span>
                <span>{defaultAddress.address}</span>
                <span>{defaultAddress.cityArea}</span>
              </address>
            ) : (
              <AccountEmptyState
                title={t.account.addresses.emptyTitle}
                text={t.account.addresses.emptyText}
                action={
                  <TextLink
                    link={{
                      label: t.account.addresses.add,
                      href: paths.accountAddresses,
                    }}
                  />
                }
              />
            ))}
        </AccountSection>

        <AccountSection
          id="account-details"
          title={t.account.details.title}
          action={
            <TextLink
              link={{
                label: t.account.details.edit,
                href: paths.accountDetails,
              }}
            />
          }
        >
          <dl className="overview-details">
            <div>
              <dt>{t.account.details.name}</dt>
              <dd>{name}</dd>
            </div>
            <div>
              <dt>{t.account.details.email}</dt>
              <dd>
                <bdi dir="ltr">{data.email}</bdi>
              </dd>
            </div>
          </dl>
        </AccountSection>
      </div>
    </>
  )
}
