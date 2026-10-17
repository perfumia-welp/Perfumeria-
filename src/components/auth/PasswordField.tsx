import { useState, type ChangeEvent } from "react"
import { useI18n } from "@/i18n/i18nContext"
import FormField from "../ui/FormField"

interface PasswordFieldProps {
  id: string
  name: string
  label: string
  value: string
  error?: string
  placeholder?: string
  autoComplete: "current-password" | "new-password"
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

/**
 * Underline password field with a quiet Show/Hide text toggle. The value is
 * typed left to right in every language, like the email field.
 */
export default function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const copy = useI18n().t.auth.password
  return (
    <div className="password-field">
      <FormField {...props} type={visible ? "text" : "password"} dir="ltr" />
      <button
        type="button"
        className="password-field__toggle"
        aria-controls={props.id}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? copy.hide : copy.show}
        <span className="visually-hidden">{copy.suffix}</span>
      </button>
    </div>
  )
}
