import { useId, useRef, useState, type FormEvent } from "react"
import { useI18n } from "@/i18n/i18nContext"
import { isValidEmail } from "@/lib/validation"
import { subscribeToNewsletter } from "@/services/newsletter"
import Icon from "../ui/Icon"

type FormState = "idle" | "invalid" | "submitting" | "done" | "failed"

/** Kept as a key so the shown message follows a language switch. */
type MessageKey = "empty" | "invalid" | "subscribed" | "unavailable" | "error"

/*
 * Validates locally, then hands the address to the newsletter service.
 * The service is not connected to any API yet and reports that honestly,
 * so the form never claims a subscription that did not happen.
 */
export default function NewsletterForm({
  placeholder,
}: {
  placeholder: string
}) {
  const inputId = useId()
  const messageId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<FormState>("idle")
  const [messageKey, setMessageKey] = useState<MessageKey | null>(null)
  const { t } = useI18n()
  const message = messageKey ? t.footer.newsletter.messages[messageKey] : ""

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = inputRef.current?.value.trim() ?? ""

    if (!isValidEmail(email)) {
      setState("invalid")
      setMessageKey(email ? "invalid" : "empty")
      inputRef.current?.focus()
      return
    }

    setState("submitting")
    const result = await subscribeToNewsletter(email)
    if (result.status === "error") {
      setState("failed")
      setMessageKey("error")
    } else {
      setState("done")
      setMessageKey(result.status)
    }
  }

  const clearError = () => {
    if (state === "invalid") {
      setState("idle")
      setMessageKey(null)
    }
  }

  const isInvalid = state === "invalid"

  return (
    <form
      className={`newsletter-form${isInvalid ? " is-invalid" : ""}`}
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="newsletter-form__field">
        <label className="visually-hidden" htmlFor={inputId}>
          {t.footer.newsletter.label}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="email"
          name="email"
          inputMode="email"
          dir="ltr"
          autoComplete="email"
          placeholder={placeholder}
          aria-invalid={isInvalid}
          aria-describedby={message ? messageId : undefined}
          onChange={clearError}
        />
        <button
          type="submit"
          aria-label={t.footer.newsletter.submit}
          disabled={state === "submitting"}
        >
          <Icon name="arrow" />
        </button>
      </div>
      <p id={messageId} className="newsletter-form__message" role="status">
        {message}
      </p>
    </form>
  )
}
