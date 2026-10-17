import { useEffect, useRef, useState } from "react"
import { Navigate } from "react-router"
import { useAuth } from "@/auth/authContext"
import { authErrorText } from "@/auth/authErrors"
import {
  useValidatedForm,
  type FormStatus,
  type ValidationKey,
} from "@/hooks/useValidatedForm"
import AuthLayout, { AuthStatus } from "@/components/auth/AuthLayout"
import PasswordField from "@/components/auth/PasswordField"
import FormField from "@/components/ui/FormField"
import Icon from "@/components/ui/Icon"
import TextLink from "@/components/ui/TextLink"
import { useI18n } from "@/i18n/i18nContext"
import { isValidEmail, PASSWORD_MIN_LENGTH } from "@/lib/validation"
import { paths } from "@/router/paths"

type Field = "firstName" | "lastName" | "email" | "password" | "confirmPassword"

function validate(values: Record<Field, string>) {
  const errors: Partial<Record<Field, ValidationKey>> = {}
  if (!values.firstName.trim()) errors.firstName = "firstNameRequired"
  if (!values.lastName.trim()) errors.lastName = "lastNameRequired"
  if (!values.email.trim()) errors.email = "emailRequired"
  else if (!isValidEmail(values.email)) errors.email = "emailInvalid"
  if (!values.password) errors.password = "passwordChoose"
  else if (values.password.length < PASSWORD_MIN_LENGTH)
    errors.password = "passwordTooShort"
  if (!values.confirmPassword)
    errors.confirmPassword = "confirmPasswordRequired"
  else if (values.confirmPassword !== values.password)
    errors.confirmPassword = "passwordsMismatch"
  return errors
}

const EMPTY: Record<Field, string> = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
}

export default function SignUpPage() {
  const { user, signUp, resendConfirmation } = useAuth()
  const form = useValidatedForm<Field>(EMPTY, validate)
  /** Set once Supabase has accepted the sign-up but needs email confirmation. */
  const [pendingEmail, setPendingEmail] = useState("")
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<FormStatus | null>(null)
  const messageRef = useRef<HTMLHeadingElement>(null)
  const { t, localize } = useI18n()
  const copy = t.auth

  // The form is replaced by the confirmation message; move focus to it.
  useEffect(() => {
    if (pendingEmail) messageRef.current?.focus()
  }, [pendingEmail])

  // Without email confirmation Supabase signs the visitor straight in.
  if (user) return <Navigate to={localize(paths.account)} replace />

  const submit = form.onSubmit(async (values) => {
    const result = await signUp(values)
    if (!result.ok)
      form.setStatus({ tone: "error", message: authErrorText(result.error) })
    else if (result.needsConfirmation) setPendingEmail(values.email.trim())
  })

  const resend = async () => {
    setResending(true)
    const result = await resendConfirmation(pendingEmail)
    setResending(false)
    setResendStatus(
      result.ok
        ? { tone: "info", message: (text) => text.auth.signUp.resent }
        : { tone: "error", message: authErrorText(result.error) },
    )
  }

  const aside = (
    <div>
      <p>{copy.signUp.haveAccount}</p>
      <TextLink link={{ label: copy.signUp.signIn, href: paths.signIn }} />
    </div>
  )

  if (pendingEmail) {
    return (
      <AuthLayout
        intro={copy.intros.signUp}
        note={copy.notes.signUp}
        aside={aside}
      >
        <div className="auth-message">
          <h2 tabIndex={-1} ref={messageRef}>
            {copy.checkInbox}
          </h2>
          <p>
            {copy.signUp.sentBefore}
            <strong>{pendingEmail}</strong>
            {copy.signUp.sentAfter}
          </p>
          <div className="auth-message__actions">
            <button
              type="button"
              className="auth-form__secondary"
              disabled={resending}
              onClick={resend}
            >
              {resending ? t.common.sending : copy.resend}
            </button>
            <AuthStatus tone={resendStatus?.tone}>
              {resendStatus?.message(t)}
            </AuthStatus>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      intro={copy.intros.signUp}
      note={copy.notes.signUp}
      aside={aside}
    >
      <form
        ref={form.formRef}
        className="auth-form"
        noValidate
        onSubmit={submit}
        aria-describedby={`${form.baseId}-status`}
      >
        <FormField
          label={copy.fields.firstName}
          autoComplete="given-name"
          className="auth-form__half"
          {...form.fieldProps("firstName")}
        />
        <FormField
          label={copy.fields.lastName}
          autoComplete="family-name"
          className="auth-form__half"
          {...form.fieldProps("lastName")}
        />
        <FormField
          label={copy.fields.email}
          type="email"
          autoComplete="email"
          {...form.fieldProps("email")}
        />
        <PasswordField
          label={copy.fields.password}
          autoComplete="new-password"
          {...form.fieldProps("password")}
        />
        <p className="auth-form__hint">{copy.password.hint}</p>
        <PasswordField
          label={copy.fields.confirmPassword}
          autoComplete="new-password"
          {...form.fieldProps("confirmPassword")}
        />

        <div className="auth-form__submit">
          <button
            type="submit"
            className="button-primary"
            disabled={form.submitting}
          >
            {form.submitting ? copy.signUp.submitting : copy.signUp.submit}{" "}
            <Icon name="arrow" />
          </button>
          <AuthStatus id={`${form.baseId}-status`} tone={form.status?.tone}>
            {form.statusText}
          </AuthStatus>
        </div>
      </form>
    </AuthLayout>
  )
}
