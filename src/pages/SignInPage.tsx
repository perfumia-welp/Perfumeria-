import { useState } from "react"
import { Navigate, useLocation } from "react-router"
import { useAuth } from "@/auth/authContext"
import { authErrorText } from "@/auth/authErrors"
import type { AuthRedirectState } from "@/auth/RequireAuth"
import {
  useValidatedForm,
  type FormStatus,
  type ValidationKey,
} from "@/hooks/useValidatedForm"
import AuthLayout, { AuthStatus } from "@/components/auth/AuthLayout"
import PasswordField from "@/components/auth/PasswordField"
import AppLink from "@/components/ui/AppLink"
import FormField from "@/components/ui/FormField"
import Icon from "@/components/ui/Icon"
import TextLink from "@/components/ui/TextLink"
import { useI18n } from "@/i18n/i18nContext"
import { isValidEmail } from "@/lib/validation"
import { paths } from "@/router/paths"

type Field = "email" | "password"

function validate(values: Record<Field, string>) {
  const errors: Partial<Record<Field, ValidationKey>> = {}
  if (!values.email.trim()) errors.email = "emailRequired"
  else if (!isValidEmail(values.email)) errors.email = "emailInvalid"
  if (!values.password) errors.password = "passwordRequired"
  return errors
}

export default function SignInPage() {
  const { user, signIn, resendConfirmation, linkError } = useAuth()
  const location = useLocation()
  const from = (location.state as AuthRedirectState | null)?.from
  const form = useValidatedForm<Field>({ email: "", password: "" }, validate)
  const [resending, setResending] = useState(false)
  const { t, localize } = useI18n()
  const copy = t.auth

  // Signed in (now or already): continue to the account, or the guarded page
  // that sent the visitor here.
  if (user) return <Navigate to={from ?? localize(paths.account)} replace />

  const linkStatus: FormStatus | null = linkError
    ? { tone: "error", message: authErrorText(linkError), code: linkError }
    : null
  const status = form.status ?? linkStatus
  const unconfirmed = status?.code === "email_not_confirmed"

  const submit = form.onSubmit(async (values) => {
    const result = await signIn(values.email, values.password)
    if (!result.ok)
      form.setStatus({
        tone: "error",
        message: authErrorText(result.error),
        code: result.error,
      })
  })

  const resend = async () => {
    setResending(true)
    const result = await resendConfirmation(form.values.email)
    setResending(false)
    const email = form.values.email.trim()
    form.setStatus(
      result.ok
        ? { tone: "info", message: (text) => text.auth.signIn.resent(email) }
        : {
            tone: "error",
            message: authErrorText(result.error),
            code: result.error,
          },
    )
  }

  return (
    <AuthLayout
      intro={copy.intros.signIn}
      note={copy.notes.signIn}
      aside={
        <div>
          <p>{copy.signIn.newHere}</p>
          <TextLink
            link={{ label: copy.signIn.createAccount, href: paths.signUp }}
          />
        </div>
      }
    >
      <form
        ref={form.formRef}
        className="auth-form"
        noValidate
        onSubmit={submit}
        aria-describedby={`${form.baseId}-status`}
      >
        <FormField
          label={copy.fields.email}
          placeholder={copy.placeholders.email}
          type="email"
          autoComplete="email"
          {...form.fieldProps("email")}
        />
        <PasswordField
          label={copy.fields.password}
          placeholder={copy.placeholders.password}
          autoComplete="current-password"
          {...form.fieldProps("password")}
        />
        <p className="auth-form__hint auth-form__hint--end">
          <AppLink className="auth-form__secondary" href={paths.forgotPassword}>
            {copy.signIn.forgot}
          </AppLink>
        </p>

        <div className="auth-form__submit">
          <button
            type="submit"
            className="button-primary"
            disabled={form.submitting}
          >
            {form.submitting ? copy.signIn.submitting : copy.signIn.submit}{" "}
            <Icon name="arrow" />
          </button>
          <AuthStatus id={`${form.baseId}-status`} tone={status?.tone}>
            {status?.message(t)}
          </AuthStatus>
        </div>

        {unconfirmed && (
          <p className="auth-form__hint">
            <button
              type="button"
              className="auth-form__secondary"
              disabled={resending}
              onClick={resend}
            >
              {resending ? t.common.sending : copy.resend}
            </button>
          </p>
        )}
      </form>
    </AuthLayout>
  )
}
