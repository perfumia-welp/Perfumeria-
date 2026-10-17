import { useId, useRef, useState, type FormEvent } from "react"
import type { ValidationKey } from "@/hooks/useValidatedForm"
import { useI18n } from "@/i18n/i18nContext"
import type { Messages } from "@/i18n/messages"
import { isValidEmail, isValidPhone } from "@/lib/validation"
import { sendContactMessage } from "@/services/contact"
import type { ContactFormValues } from "@/types/commerce"
import FormField from "../ui/FormField"
import Icon from "../ui/Icon"
import "./ContactForm.css"

type Field = keyof ContactFormValues
type Errors = Partial<Record<Field, ValidationKey>>

/** Kept as a key so the status follows a language switch. */
type StatusKey = keyof Messages["contact"]["status"] | "error"

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

/*
 * Validates locally, then hands the message to services/contact.ts. That
 * service is not connected yet and reports it, so the form never claims a
 * message was sent when it was not.
 */
export default function ContactForm() {
  const baseId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<ContactFormValues>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<FormStatus | null>(null)
  const { t } = useI18n()
  const copy = t.contact
  const statusText = !status
    ? ""
    : status.key === "error"
      ? t.common.genericError
      : copy.status[status.key]

  const fieldId = (field: Field) => `${baseId}-${field}`

  const change = (field: Field) => (value: string) => {
    const next = { ...values, [field]: value }
    setValues(next)
    // After a failed attempt, re-check as the visitor corrects each field.
    if (attempted) setErrors(validate(next))
    if (status?.tone === "info") setStatus(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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

    setSubmitting(true)
    const result = await sendContactMessage(values)
    setSubmitting(false)
    if (result.status === "success") {
      setStatus({ tone: "info", key: "success" })
      setValues(EMPTY)
      setAttempted(false)
    } else if (result.status === "unavailable") {
      setStatus({ tone: "info", key: "unavailable" })
    } else {
      setStatus({ tone: "error", key: "error" })
    }
  }

  const fieldProps = (field: Field) => ({
    id: fieldId(field),
    name: field,
    value: values[field],
    error: errors[field] && t.validation[errors[field]],
    onChange: (event: { target: { value: string } }) =>
      change(field)(event.target.value),
  })

  return (
    <form
      ref={formRef}
      className="contact-form"
      noValidate
      onSubmit={handleSubmit}
    >
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

      <div className="contact-form__submit contact-form__wide">
        <button type="submit" className="button-primary" disabled={submitting}>
          {copy.form.submit} <Icon name="arrow" />
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
