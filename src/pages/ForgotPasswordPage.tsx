import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/auth/authContext"
import { authErrorText } from "@/auth/authErrors"
import { useValidatedForm, type ValidationKey } from "@/hooks/useValidatedForm"
import AuthLayout, { AuthStatus } from "@/components/auth/AuthLayout"
import FormField from "@/components/ui/FormField"
import Icon from "@/components/ui/Icon"
import TextLink from "@/components/ui/TextLink"
import { useI18n } from "@/i18n/i18nContext"
import { isValidEmail } from "@/lib/validation"
import { paths } from "@/router/paths"

type Field = "email"

function validate(values: Record<Field, string>) {
  const errors: Partial<Record<Field, ValidationKey>> = {}
  if (!values.email.trim()) errors.email = "emailRequired"
  else if (!isValidEmail(values.email)) errors.email = "emailInvalid"
  return errors
}

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const form = useValidatedForm<Field>({ email: "" }, validate)
  /** Set once Supabase has accepted the reset request. */
  const [sentTo, setSentTo] = useState("")
  const messageRef = useRef<HTMLHeadingElement>(null)
  const copy = useI18n().t.auth

  useEffect(() => {
    if (sentTo) messageRef.current?.focus()
  }, [sentTo])

  const submit = form.onSubmit(async (values) => {
    const result = await requestPasswordReset(values.email)
    if (result.ok) setSentTo(values.email.trim())
    else form.setStatus({ tone: "error", message: authErrorText(result.error) })
  })

  const aside = (
    <div>
      <p>{copy.forgotPassword.remembered}</p>
      <TextLink
        link={{ label: copy.forgotPassword.backToSignIn, href: paths.signIn }}
      />
    </div>
  )

  return (
    <AuthLayout
      intro={copy.intros.forgotPassword}
      note={copy.notes.forgotPassword}
      aside={aside}
    >
      {sentTo ? (
        <div className="auth-message">
          <h2 tabIndex={-1} ref={messageRef}>
            {copy.checkInbox}
          </h2>
          {/* Supabase does not reveal whether an account exists, so neither do we. */}
          <p>
            {copy.forgotPassword.sentBefore}
            <strong>{sentTo}</strong>
            {copy.forgotPassword.sentAfter}
          </p>
          <div className="auth-message__actions">
            <button
              type="button"
              className="auth-form__secondary"
              onClick={() => setSentTo("")}
            >
              {copy.forgotPassword.differentEmail}
            </button>
          </div>
        </div>
      ) : (
        <form
          ref={form.formRef}
          className="auth-form"
          noValidate
          onSubmit={submit}
          aria-describedby={`${form.baseId}-status`}
        >
          <FormField
            label={copy.fields.email}
            type="email"
            autoComplete="email"
            {...form.fieldProps("email")}
          />
          <div className="auth-form__submit">
            <button
              type="submit"
              className="button-primary"
              disabled={form.submitting}
            >
              {form.submitting
                ? copy.forgotPassword.submitting
                : copy.forgotPassword.submit}{" "}
              <Icon name="arrow" />
            </button>
            <AuthStatus id={`${form.baseId}-status`} tone={form.status?.tone}>
              {form.statusText}
            </AuthStatus>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
