import AccountDetails from "@/components/account/AccountDetails"
import { useAccountData } from "@/components/account/AccountContext"
import { useI18n } from "@/i18n/i18nContext"

export default function AccountDetailsPage() {
  const { t } = useI18n()
  const data = useAccountData()
  return (
    <>
      <p className="eyebrow">{t.account.eyebrow}</p>
      <h2 className="account-content__title account-content__title--compact">
        {t.account.nav.details}
      </h2>
      <AccountDetails
        userId={data.userId}
        email={data.email}
        profile={data.profile.state}
        fallback={data.fallback}
        onSaved={data.profile.replace}
        onRetry={data.profile.reload}
      />
    </>
  )
}
