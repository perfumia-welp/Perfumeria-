import { createContext, useContext } from "react"
import type { useRemoteData } from "@/hooks/useRemoteData"
import type {
  CustomerProfile,
  OrderHistoryEntry,
  SavedAddress,
} from "@/types/account"

type RemoteResource<T> = ReturnType<typeof useRemoteData<T>>

export type AccountData = {
  userId: string
  email: string
  fallback: CustomerProfile
  fullName: string
  phone: string
  profile: RemoteResource<CustomerProfile | null>
  addresses: RemoteResource<SavedAddress[]>
  orders: RemoteResource<OrderHistoryEntry[]>
}

export const AccountContext = createContext<AccountData | null>(null)

export function useAccountData() {
  const value = useContext(AccountContext)
  if (!value) throw new Error("useAccountData must be used inside AccountPage")
  return value
}
