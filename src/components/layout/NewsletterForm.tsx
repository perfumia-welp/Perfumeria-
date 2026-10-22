import { useId, useRef, useState, type FormEvent } from "react"
import { useI18n } from "@/i18n/i18nContext"
import { isValidEmail } from "@/lib/validation"
import { subscribeToNewsletter } from "@/services/newsletter"
import Icon from "../ui/Icon"

type FormState = "idle" | "invalid" | "submitting" | "done" | "failed"

/** Kept as a key so the shown message follows a language switch. */
type MessageKey =
  | "empty"
  | "invalid"
  | "subscribed"
  | "alreadySubscribed"
  | "unavailable"
  | "rateLimited"
  | "error"

/*
 * Validates locally, then sends the address to the server, which adds it to
 * the private subscriber list. The message says what actually happened:
 * subscribed, already on the list, or why it was not saved (the static
 * preview has no server, so it reports sign-up as unavailable there).
 */
export default function NewsletterForm({
  placeholder,
}: {
  placeholder: string
}) {
  const inputId = useId()
  const messageId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const trapRef = useRef<HTMLInputElement>(null)
  // Guards against a second submit before React re-renders the disabled button.
  const sendingRef = useRef(false)
  const [state, setState] = useState<FormState>("idle")
  const [messageKey, setMessageKey] = useState<MessageKey | null>(null)
  const { t, locale } = useI18n()
  const message = messageKey ? t.footer.newsletter.messages[messageKey] : ""

  const showInvalid = (key: "empty" | "invalid") => {
    setState("invalid")
    setMessageKey(key)
    inputRef.current?.focus()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sendingRef.current) return
    const email = inputRef.current?.value.trim() ?? ""

    if (!isValidEmail(email)) {
      showInvalid(email ? "invalid" : "empty")
      return
    }

    sendingRef.current = true
    setState("submitting")
    setMessageKey(null)
    const result = await subscribeToNewsletter({
      email,
      locale,
      nectar: trapRef.current?.value ?? "",
    })
    sendingRef.current = false

    switch (result.status) {
      case "subscribed":
      case "alreadySubscribed":
        setState("done")
        setMessageKey(result.status)
        if (inputRef.current) inputRef.current.value = ""
        break
      case "invalid":
        showInvalid("invalid")
        break
      default:
        setState("failed")
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
  const isSubmitting = state === "submitting"

  return (
    <form
      className={`newsletter-form${isInvalid ? " is-invalid" : ""}`}
      noValidate
      aria-busy={isSubmitting}
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
          disabled={isSubmitting}
        >
          <Icon name="arrow" />
        </button>
      </div>
      {/* Spam trap: hidden from people and assistive technology, left empty. */}
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor={`${inputId}-nectar`}>Leave this field empty</label>
        <input
          ref={trapRef}
          id={`${inputId}-nectar`}
          type="text"
          name="nectar"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      <p id={messageId} className="newsletter-form__message" role="status">
        {isSubmitting ? t.footer.newsletter.messages.submitting : message}
      </p>
    </form>
  )
}
