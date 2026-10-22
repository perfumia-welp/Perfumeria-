import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { useSearchParams } from "react-router"
import type { ValidationKey } from "@/hooks/useValidatedForm"
import { useI18n } from "@/i18n/i18nContext"
import type { Messages } from "@/i18n/messages"
import { isValidEmail, isValidPhone } from "@/lib/validation"
import { CONTACT_TOPICS, type ContactTopic } from "@/router/paths"
import { sendContactMessage } from "@/services/contact"
import type { ContactFormValues } from "@/types/commerce"
import FormField from "../ui/FormField"
import Icon from "../ui/Icon"
import "./ContactForm.css"

type Field = keyof ContactFormValues
type Errors = Partial<Record<Field, ValidationKey>>

/** Kept as a key so the status follows a language switch. */
type StatusKey = keyof Messages["contact"]["status"]

interface FormStatus {
  tone: "info" | "error"
  key: StatusKey
}

const EMPTY: ContactFormValues = {
  fullName: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
}

/** Field order, used to focus the first invalid field. */
const FIELDS: Field[] = ["fullName", "email", "phone", "subject", "message"]

/** Same limits as server/contact.mjs, so the server accepts any valid form. */
const MAX_LENGTH: Record<Field, number> = {
  fullName: 120,
  email: 254,
  phone: 40,
  subject: 200,
  message: 5000,
}

function validate(values: ContactFormValues): Errors {
  const errors: Errors = {}
  if (!values.fullName.trim()) errors.fullName = "fullNameRequired"
  if (!values.email.trim()) errors.email = "emailRequired"
  else if (!isValidEmail(values.email)) errors.email = "emailInvalid"
  if (values.phone.trim() && !isValidPhone(values.phone))
    errors.phone = "phoneInvalid"
  if (!values.subject.trim()) errors.subject = "subjectRequired"
  if (!values.message.trim()) errors.message = "messageRequired"
  return errors
}

const isTopic = (value: string | null): value is ContactTopic =>
  (CONTACT_TOPICS as readonly (string | null)[]).includes(value)

/*
 * Validates locally, then hands the message to services/contact.ts, which
 * posts it to the site's server to be emailed to the store. Success is shown
 * only when the mail server accepted it; otherwise the visitor keeps what
 * they wrote and can send again.
 */
export default function ContactForm() {
  const baseId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const trapRef = useRef<HTMLInputElement>(null)
  // Blocks a second submit before React re-renders the disabled button.
  const sendingRef = useRef(false)
  const [values, setValues] = useState<ContactFormValues>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<FormStatus | null>(null)
  const { t, locale } = useI18n()
  const copy = t.contact
  const [searchParams] = useSearchParams()
  const topicParam = searchParams.get("topic")
  const topic = isTopic(topicParam) ? topicParam : null
  const topicSubject = topic ? copy.topics[topic] : ""
  // Order tracking is by contact only: ask for the order reference.
  const topicNote = topic === "track-order" ? copy.topicNotes.trackOrder : ""
  const statusText = status ? copy.status[status.key] : ""

  const fieldId = (field: Field) => `${baseId}-${field}`

  // A link such as /contact?topic=wholesale suggests the subject; it never
  // replaces one the visitor has written, and stays editable.
  useEffect(() => {
    if (!topicSubject) return
    setValues((current) =>
      current.subject.trim() ? current : { ...current, subject: topicSubject },
    )
  }, [topicSubject])

  const change = (field: Field) => (value: string) => {
    const next = { ...values, [field]: value }
    setValues(next)
    // After a failed attempt, re-check as the visitor corrects each field.
    if (attempted) setErrors(validate(next))
    if (status?.tone === "info" && !submitting) setStatus(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sendingRef.current) return
    setAttempted(true)
    const nextErrors = validate(values)
    setErrors(nextErrors)

    const firstInvalid = FIELDS.find((field) => nextErrors[field])
    if (firstInvalid) {
      setStatus({ tone: "error", key: "invalid" })
      formRef.current
        ?.querySelector<HTMLElement>(`#${CSS.escape(fieldId(firstInvalid))}`)
        ?.focus()
      return
    }

    sendingRef.current = true
    setSubmitting(true)
    setStatus({ tone: "info", key: "sending" })
    const result = await sendContactMessage({
      ...values,
      topic,
      locale,
      nectar: trapRef.current?.value ?? "",
    })
    sendingRef.current = false
    setSubmitting(false)
    if (result.status === "success") {
      setStatus({ tone: "info", key: "success" })
      // Ready for another message; a topic link keeps its suggested subject.
      setValues({ ...EMPTY, subject: topicSubject })
      setAttempted(false)
    } else if (result.status === "unavailable") {
      setStatus({ tone: "info", key: "unavailable" })
    } else if (result.status === "rateLimited") {
      setStatus({ tone: "error", key: "rateLimited" })
    } else {
      setStatus({ tone: "error", key: "failed" })
    }
  }

  const fieldProps = (field: Field) => ({
    id: fieldId(field),
    name: field,
    value: values[field],
    maxLength: MAX_LENGTH[field],
    error: errors[field] && t.validation[errors[field]],
    onChange: (event: { target: { value: string } }) =>
      change(field)(event.target.value),
  })

  return (
    <form
      ref={formRef}
      className="contact-form"
      noValidate
      aria-busy={submitting}
      onSubmit={handleSubmit}
    >
      {topicNote && (
        <p className="contact-form__note contact-form__wide">{topicNote}</p>
      )}
      <FormField
        label={copy.form.fullName}
        autoComplete="name"
        {...fieldProps("fullName")}
      />
      <FormField
        label={copy.form.email}
        type="email"
        autoComplete="email"
        {...fieldProps("email")}
      />
      <FormField
        label={copy.form.phone}
        type="tel"
        autoComplete="tel"
        optional
        {...fieldProps("phone")}
      />
      <FormField label={copy.form.subject} {...fieldProps("subject")} />
      <FormField
        label={copy.form.message}
        multiline
        className="contact-form__wide"
        {...fieldProps("message")}
      />
      {/* Spam trap: hidden from people and assistive technology, left empty. */}
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor={`${baseId}-nectar`}>Leave this field empty</label>
        <input
          ref={trapRef}
          id={`${baseId}-nectar`}
          type="text"
          name="nectar"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className="contact-form__submit contact-form__wide">
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? copy.form.sending : copy.form.submit}{" "}
          <Icon name="arrow" />
        </button>
        <p
          id={`${baseId}-status`}
          className={`contact-form__status${
            status?.tone === "error" ? " is-error" : ""
          }`}
          role="status"
        >
          {statusText}
        </p>
      </div>
    </form>
  )
}
