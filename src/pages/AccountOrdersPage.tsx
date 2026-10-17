import OrderHistory from "@/components/account/OrderHistory"
import { useAccountData } from "@/components/account/AccountContext"
import { useI18n } from "@/i18n/i18nContext"

export default function AccountOrdersPage() {
  const { t } = useI18n()
  const { orders } = useAccountData()
  return (
    <>
      <p className="eyebrow">{t.account.eyebrow}</p>
      <h2 className="account-content__title account-content__title--compact">
        {t.account.nav.orders}
      </h2>
      <OrderHistory orders={orders.state} onRetry={orders.reload} showAll />
    </>
  )
}
