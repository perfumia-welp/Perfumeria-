import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/auth/authContext"
import { authErrorText } from "@/auth/authErrors"
import { useValidatedForm, type ValidationKey } from "@/hooks/useValidatedForm"
import AuthLayout, { AuthStatus } from "@/components/auth/AuthLayout"
import PasswordField from "@/components/auth/PasswordField"
import Icon from "@/components/ui/Icon"
import TextLink from "@/components/ui/TextLink"
import { useI18n } from "@/i18n/i18nContext"
import { PASSWORD_MIN_LENGTH } from "@/lib/validation"
import { paths } from "@/router/paths"

type Field = "password" | "confirmPassword"

function validate(values: Record<Field, string>) {
  const errors: Partial<Record<Field, ValidationKey>> = {}
  if (!values.password) errors.password = "passwordChooseNew"
  else if (values.password.length < PASSWORD_MIN_LENGTH)
    errors.password = "passwordTooShort"
  if (!values.confirmPassword)
    errors.confirmPassword = "confirmNewPasswordRequired"
  else if (values.confirmPassword !== values.password)
    errors.confirmPassword = "passwordsMismatch"
  return errors
}

/*
 * Reached from the Supabase recovery email. The form only appears once that
 * link has produced a recovery session; otherwise the page says the link is
 * invalid rather than showing a form that cannot work.
 */
export default function ResetPasswordPage() {
  const { user, isLoading, isRecovery, linkError, updatePassword } = useAuth()
  const form = useValidatedForm<Field>(
    { password: "", confirmPassword: "" },
    validate,
  )
  const [done, setDone] = useState(false)
  const messageRef = useRef<HTMLHeadingElement>(null)
  const copy = useI18n().t.auth

  useEffect(() => {
    if (done) messageRef.current?.focus()
  }, [done])

  const submit = form.onSubmit(async (values) => {
    const result = await updatePassword(values.password)
    if (result.ok) setDone(true)
    else form.setStatus({ tone: "error", message: authErrorText(result.error) })
  })

  let content
  if (done) {
    content = (
      <div className="auth-message">
        <h2 tabIndex={-1} ref={messageRef}>
          {copy.resetPassword.updatedTitle}
        </h2>
        <p>{copy.resetPassword.updatedText}</p>
        <div className="auth-message__actions">
          <TextLink
            link={{
              label: copy.resetPassword.goToAccount,
              href: paths.account,
            }}
          />
        </div>
      </div>
    )
  } else if (isLoading) {
    content = (
      <p className="eyebrow" role="status">
        {copy.resetPassword.checking}
      </p>
    )
  } else if (!isRecovery || !user) {
    content = (
      <div className="auth-message">
        <h2>{copy.resetPassword.invalidTitle}</h2>
        <p>
          {linkError
            ? copy.errors[linkError]
            : copy.resetPassword.invalidDefault}{" "}
          {copy.resetPassword.invalidNote}
        </p>
        <div className="auth-message__actions">
          <TextLink
            link={{
              label: copy.resetPassword.requestNew,
              href: paths.forgotPassword,
            }}
          />
        </div>
      </div>
    )
  } else {
    content = (
      <form
        ref={form.formRef}
        className="auth-form"
        noValidate
        onSubmit={submit}
        aria-describedby={`${form.baseId}-status`}
      >
        {/* Lets password managers save the new password against the account. */}
        <input
          type="email"
          autoComplete="username"
          value={user.email ?? ""}
          readOnly
          hidden
        />
        <PasswordField
          label={copy.fields.newPassword}
          autoComplete="new-password"
          {...form.fieldProps("password")}
        />
        <p className="auth-form__hint">{copy.password.hint}</p>
        <PasswordField
          label={copy.fields.confirmNewPassword}
          autoComplete="new-password"
          {...form.fieldProps("confirmPassword")}
        />
        <div className="auth-form__submit">
          <button
            type="submit"
            className="button-primary"
            disabled={form.submitting}
          >
            {form.submitting
              ? copy.resetPassword.submitting
              : copy.resetPassword.submit}{" "}
            <Icon name="arrow" />
          </button>
          <AuthStatus id={`${form.baseId}-status`} tone={form.status?.tone}>
            {form.statusText}
          </AuthStatus>
        </div>
      </form>
    )
  }

  return (
    <AuthLayout
      intro={copy.intros.resetPassword}
      note={copy.notes.resetPassword}
    >
      {content}
    </AuthLayout>
  )
}
