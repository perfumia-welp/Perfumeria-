import AddressBook from "@/components/account/AddressBook"
import { useAccountData } from "@/components/account/AccountContext"
import { useI18n } from "@/i18n/i18nContext"

export default function AccountAddressesPage() {
  const { t } = useI18n()
  const data = useAccountData()
  return (
    <>
      <p className="eyebrow">{t.account.eyebrow}</p>
      <h2 className="account-content__title account-content__title--compact">
        {t.account.nav.addresses}
      </h2>
      <AddressBook
        addresses={data.addresses.state}
        defaults={{ fullName: data.fullName, phone: data.phone }}
        onChanged={data.addresses.reload}
      />
    </>
  )
}
