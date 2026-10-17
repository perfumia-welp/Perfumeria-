import { useEffect, useState } from "react"
import { useValidatedForm, type ValidationKey } from "@/hooks/useValidatedForm"
import type { RemoteData } from "@/hooks/useRemoteData"
import { useI18n } from "@/i18n/i18nContext"
import type { Translatable } from "@/i18n/messages"
import { isValidPhone } from "@/lib/validation"
import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from "@/services/account"
import type {
  AccountErrorCode,
  AddressInput,
  SavedAddress,
} from "@/types/account"
import FormField from "../ui/FormField"
import {
  AccountEmptyState,
  AccountLoadError,
  AccountLoading,
  AccountSection,
  AccountTextButton,
  FormActions,
  focusSectionHeading,
} from "./AccountSections"

const SECTION_ID = "account-addresses"
const MAX_ADDRESSES = 20

type Field = "label" | "fullName" | "phone" | "address" | "cityArea"

function validate(values: Record<Field, string>) {
  const errors: Partial<Record<Field, ValidationKey>> = {}
  if (!values.fullName.trim()) errors.fullName = "fullNameRequired"
  if (!values.phone.trim()) errors.phone = "phoneRequired"
  else if (!isValidPhone(values.phone)) errors.phone = "phoneInvalid"
  if (!values.address.trim()) errors.address = "addressRequired"
  if (!values.cityArea.trim()) errors.cityArea = "cityAreaRequired"
  return errors
}

const errorMessage = (code: AccountErrorCode): Translatable => (t) =>
  code === "address_limit" ? t.account.addresses.limit : t.account.saveError

export type AddressDefaults = Pick<AddressInput, "fullName" | "phone">

/* Named prop interfaces: oxfmt 0.2.0 moves comments inside inline types. */
interface AddressFormProps {
  /** null for a new address. */
  address: SavedAddress | null
  /** Prefill for a new address (the customer's own name and phone). */
  defaults: AddressDefaults
  /** The first address always becomes the default. */
  isFirst: boolean
  onSaved: () => void
  onCancel: () => void
}

/** Form for a new address or an existing one. */
function AddressForm({
  address,
  defaults,
  isFirst,
  onSaved,
  onCancel,
}: AddressFormProps) {
  const { t } = useI18n()
  const copy = t.account.addresses
  const form = useValidatedForm<Field>(
    {
      label: address?.label ?? "",
      fullName: address?.fullName ?? defaults.fullName,
      phone: address?.phone ?? defaults.phone,
      address: address?.address ?? "",
      cityArea: address?.cityArea ?? "",
    },
    validate,
  )
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? isFirst)
  // The default only moves by choosing another address.
  const defaultLocked = Boolean(address?.isDefault) || isFirst

  const { formRef } = form
  useEffect(() => {
    formRef.current?.querySelector("input")?.focus()
  }, [formRef])

  const submit = form.onSubmit(async (values) => {
    const input: AddressInput = { ...values, isDefault }
    const result = address
      ? await updateAddress(address.id, input)
      : await createAddress(input)
    if (result.ok) onSaved()
    else form.setStatus({ tone: "error", message: errorMessage(result.error) })
  })

  return (
    <form
      ref={formRef}
      className="account-form"
      noValidate
      onSubmit={submit}
      aria-describedby={`${form.baseId}-status`}
    >
      <fieldset>
        <legend className="account-label">
          {address ? copy.editTitle : copy.newTitle}
        </legend>
        <FormField
          label={copy.fields.label}
          optional
          maxLength={40}
          placeholder={copy.fields.labelHint}
          {...form.fieldProps("label")}
        />
        <FormField
          label={copy.fields.fullName}
          autoComplete="name"
          maxLength={120}
          {...form.fieldProps("fullName")}
        />
        <FormField
          label={copy.fields.phone}
          type="tel"
          autoComplete="tel"
          maxLength={40}
          {...form.fieldProps("phone")}
        />
        <FormField
          label={copy.fields.address}
          autoComplete="street-address"
          maxLength={300}
          {...form.fieldProps("address")}
        />
        <FormField
          label={copy.fields.cityArea}
          autoComplete="address-level2"
          maxLength={120}
          {...form.fieldProps("cityArea")}
        />
        <label className="account-form__check">
          <input
            type="checkbox"
            name="isDefault"
            checked={isDefault}
            disabled={defaultLocked}
            onChange={(event) => setIsDefault(event.target.checked)}
          />
          {copy.fields.isDefault}
        </label>
      </fieldset>
      <FormActions
        statusId={`${form.baseId}-status`}
        submitting={form.submitting}
        submitLabel={copy.save}
        statusText={form.statusText}
        isError={form.status?.tone === "error"}
        onCancel={onCancel}
      />
    </form>
  )
}

/** One saved address with its actions (edit, delete, set as default). */
function AddressItem({
  address,
  busy,
  onEdit,
  onDelete,
  onMakeDefault,
}: {
  address: SavedAddress
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onMakeDefault: () => void
}) {
  const { t } = useI18n()
  const copy = t.account.addresses
  const [confirming, setConfirming] = useState(false)
  const name = address.label || address.fullName
  const tag = [address.isDefault && copy.default, address.label]
    .filter(Boolean)
    .join(" · ")

  return (
    <li>
      {tag && <p className="account-label">{tag}</p>}
      <address className="saved-address">
        <span>{address.fullName}</span>
        <span>{address.address}</span>
        <span>{address.cityArea}</span>
        <span>
          <bdi dir="ltr">{address.phone}</bdi>
        </span>
      </address>
      {confirming ? (
        <div className="account-actions" role="group" aria-label={name}>
          <p className="account-actions__question">{copy.confirmDelete}</p>
          <button
            type="button"
            className="account-action is-danger"
            disabled={busy}
            onClick={onDelete}
          >
            {copy.confirmDeleteAction}
          </button>
          <button
            type="button"
            className="account-action"
            onClick={() => setConfirming(false)}
          >
            {t.account.cancel}
          </button>
        </div>
      ) : (
        <div className="account-actions">
          <button
            type="button"
            className="account-action"
            aria-label={copy.editLabel(name)}
            disabled={busy}
            onClick={onEdit}
          >
            {copy.edit}
          </button>
          <button
            type="button"
            className="account-action"
            aria-label={copy.deleteLabel(name)}
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            {copy.delete}
          </button>
          {!address.isDefault && (
            <button
              type="button"
              className="account-action"
              aria-label={copy.makeDefaultLabel(name)}
              disabled={busy}
              onClick={onMakeDefault}
            >
              {copy.makeDefault}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

/* Named interfaces only (oxfmt 0.2.0 mangles single-line object types). */
interface ListMode {
  mode: "list"
}

interface NewMode {
  mode: "new"
}

interface EditMode {
  mode: "edit"
  id: string
}

type Editing = ListMode | NewMode | EditMode

interface AddressBookProps {
  addresses: RemoteData<SavedAddress[]>
  /** Prefill for a new address. */
  defaults: AddressDefaults
  /** Reloads the list after any change. */
  onChanged: () => void
}

/**
 * Saved addresses from Supabase. Row level security keeps them private to
 * the customer; the database keeps exactly one default address.
 */
export default function AddressBook({
  addresses,
  defaults,
  onChanged,
}: AddressBookProps) {
  const { t } = useI18n()
  const copy = t.account.addresses
  const [editing, setEditing] = useState<Editing>({ mode: "list" })
  const [busy, setBusy] = useState(false)
  /** Outcome of the last action, translated when shown. */
  const [notice, setNotice] = useState<Translatable | null>(null)
  const [noticeIsError, setNoticeIsError] = useState(false)
  const list = addresses.status === "ready" ? addresses.data : []

  const show = (message: Translatable, isError = false) => {
    setNotice(() => message)
    setNoticeIsError(isError)
  }

  const closeForm = (message?: Translatable) => {
    setEditing({ mode: "list" })
    if (message) show(message)
    focusSectionHeading(SECTION_ID)
  }

  const run = async (
    action: () => ReturnType<typeof deleteAddress>,
    success: Translatable,
  ) => {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (result.ok) {
      show(success)
      onChanged()
    } else {
      show(errorMessage(result.error), true)
    }
  }

  const add = () => {
    setNotice(null)
    setEditing({ mode: "new" })
  }
  const canAdd =
    addresses.status === "ready" &&
    editing.mode === "list" &&
    list.length < MAX_ADDRESSES
  const current =
    editing.mode === "edit"
      ? (list.find((address) => address.id === editing.id) ?? null)
      : null

  return (
    <AccountSection
      id={SECTION_ID}
      title={copy.title}
      className="account-section--paired"
      action={
        canAdd &&
        list.length > 0 && <AccountTextButton label={copy.add} onClick={add} />
      }
    >
      {addresses.status === "loading" && <AccountLoading />}
      {addresses.status === "error" && <AccountLoadError onRetry={onChanged} />}
      {addresses.status === "ready" &&
        (editing.mode !== "list" ? (
          <AddressForm
            key={editing.mode === "edit" ? editing.id : "new"}
            address={current}
            defaults={defaults}
            isFirst={list.length === 0}
            onSaved={() => {
              onChanged()
              closeForm((messages) => messages.account.addresses.saved)
            }}
            onCancel={() => closeForm()}
          />
        ) : list.length ? (
          <ul className="address-list">
            {list.map((address) => (
              <AddressItem
                key={address.id}
                address={address}
                busy={busy}
                onEdit={() => {
                  setNotice(null)
                  setEditing({ mode: "edit", id: address.id })
                }}
                onDelete={() =>
                  run(
                    () => deleteAddress(address.id),
                    (messages) => messages.account.addresses.deleted,
                  )
                }
                onMakeDefault={() =>
                  run(
                    () => setDefaultAddress(address.id),
                    (messages) => messages.account.addresses.defaultChanged,
                  )
                }
              />
            ))}
          </ul>
        ) : (
          <AccountEmptyState
            title={copy.emptyTitle}
            text={copy.emptyText}
            action={<AccountTextButton label={copy.add} onClick={add} />}
          />
        ))}
      <p
        className={`account-status${noticeIsError ? " is-error" : ""}`}
        role="status"
      >
        {editing.mode === "list" && notice ? notice(t) : ""}
      </p>
    </AccountSection>
  )
}
