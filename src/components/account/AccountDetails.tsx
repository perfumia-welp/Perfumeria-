import { useEffect, useState } from "react"
import { useValidatedForm, type ValidationKey } from "@/hooks/useValidatedForm"
import type { RemoteData } from "@/hooks/useRemoteData"
import { useI18n } from "@/i18n/i18nContext"
import { isValidPhone } from "@/lib/validation"
import { saveProfile } from "@/services/account"
import type { CustomerProfile } from "@/types/account"
import FormField from "../ui/FormField"
import {
  AccountLoadError,
  AccountSection,
  AccountTextButton,
  FormActions,
  focusSectionHeading,
} from "./AccountSections"

const SECTION_ID = "account-details"

type Field = keyof CustomerProfile

function validate(values: CustomerProfile) {
  const errors: Partial<Record<Field, ValidationKey>> = {}
  if (!values.firstName.trim()) errors.firstName = "firstNameRequired"
  if (!values.lastName.trim()) errors.lastName = "lastNameRequired"
  if (values.phone.trim() && !isValidPhone(values.phone))
    errors.phone = "phoneInvalid"
  return errors
}

function DetailsForm({
  userId,
  initial,
  onSaved,
  onCancel,
}: {
  userId: string
  initial: CustomerProfile
  onSaved: (profile: CustomerProfile) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const copy = t.account.details
  const form = useValidatedForm<Field>(initial, validate)

  const { formRef } = form
  useEffect(() => {
    formRef.current?.querySelector("input")?.focus()
  }, [formRef])

  const submit = form.onSubmit(async (values) => {
    const result = await saveProfile(userId, values)
    if (result.ok) onSaved(result.data)
    else
      form.setStatus({
        tone: "error",
        message: (messages) => messages.account.saveError,
      })
  })

  return (
    <form
      ref={formRef}
      className="account-form account-form--details"
      noValidate
      onSubmit={submit}
      aria-describedby={`${form.baseId}-status`}
    >
      <fieldset>
        <legend className="visually-hidden">{copy.title}</legend>
        <FormField
          label={copy.firstName}
          autoComplete="given-name"
          maxLength={80}
          {...form.fieldProps("firstName")}
        />
        <FormField
          label={copy.lastName}
          autoComplete="family-name"
          maxLength={80}
          {...form.fieldProps("lastName")}
        />
        <FormField
          label={copy.phone}
          type="tel"
          autoComplete="tel"
          optional
          maxLength={40}
          {...form.fieldProps("phone")}
        />
      </fieldset>
      <p className="account-form__note">{copy.emailNote}</p>
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

/* Named prop interface: oxfmt 0.2.0 moves comments inside inline types. */
interface AccountDetailsProps {
  userId: string
  email: string
  profile: RemoteData<CustomerProfile | null>
  /** Names from the sign-up metadata. */
  fallback: CustomerProfile
  onSaved: (profile: CustomerProfile) => void
  onRetry: () => void
}

/**
 * Name and phone from the Supabase profile (sign-up metadata is the fallback
 * until the profile loads); email from Supabase Auth, shown but not editable.
 */
export default function AccountDetails({
  userId,
  email,
  profile,
  fallback,
  onSaved,
  onRetry,
}: AccountDetailsProps) {
  const { t } = useI18n()
  const copy = t.account.details
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const stored = profile.status === "ready" ? profile.data : null
  const current: CustomerProfile = {
    firstName: stored?.firstName || fallback.firstName,
    lastName: stored?.lastName || fallback.lastName,
    phone: stored?.phone ?? "",
  }

  const rows = [
    {
      label: copy.name,
      value: [current.firstName, current.lastName].filter(Boolean).join(" "),
    },
    { label: copy.phone, value: current.phone, ltr: true },
    { label: copy.email, value: email, ltr: true },
  ].filter((row) => row.value)

  const close = () => {
    setEditing(false)
    focusSectionHeading(SECTION_ID)
  }

  return (
    <AccountSection
      id={SECTION_ID}
      title={copy.title}
      action={
        profile.status === "ready" &&
        !editing && (
          <AccountTextButton
            label={copy.edit}
            onClick={() => {
              setSaved(false)
              setEditing(true)
            }}
          />
        )
      }
    >
      {editing ? (
        <DetailsForm
          userId={userId}
          initial={current}
          onSaved={(next) => {
            onSaved(next)
            setSaved(true)
            close()
          }}
          onCancel={close}
        />
      ) : (
        <dl className="account-details">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.ltr ? <bdi dir="ltr">{row.value}</bdi> : row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {profile.status === "error" && <AccountLoadError onRetry={onRetry} />}
      <p className="account-status" role="status">
        {saved && !editing ? copy.saved : ""}
      </p>
    </AccountSection>
  )
}
