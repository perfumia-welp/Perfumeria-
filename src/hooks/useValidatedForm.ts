import { useCallback, useId, useRef, useState, type FormEvent } from "react"
import { useI18n } from "@/i18n/i18nContext"
import type { Messages, Translatable } from "@/i18n/messages"

/** A field error: a key of the `validation` messages. */
export type ValidationKey = keyof Messages["validation"]

export interface FormStatus {
  tone: "info" | "error"
  /** Translated when shown, so it follows a language switch. */
  message: Translatable
  /** Identifies the outcome when a page needs to react to it (an auth error code). */
  code?: string
}

const INVALID: Translatable = (t) => t.validation.checkFields

/**
 * Form state shared by the auth and checkout forms, following ContactForm: validate
 * locally, focus the first invalid field, re-check as fields are corrected,
 * and ignore repeat submits while a request is in flight. Errors and status
 * are stored untranslated and rendered in the current language.
 */
export function useValidatedForm<Field extends string>(
  initial: Record<Field, string>,
  validate: (
    values: Record<Field, string>,
  ) => Partial<Record<Field, ValidationKey>>,
) {
  const baseId = useId()
  const { t } = useI18n()
  const formRef = useRef<HTMLFormElement>(null)
  const inFlight = useRef(false)
  /** Fields the visitor has typed in; prefill never touches them. */
  const edited = useRef(new Set<Field>())
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Partial<Record<Field, ValidationKey>>>(
    {},
  )
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<FormStatus | null>(null)

  const fieldId = (field: Field) => `${baseId}-${field}`

  const fieldProps = (field: Field) => {
    const error = errors[field]
    return {
      id: fieldId(field),
      name: field,
      value: values[field],
      error: error && t.validation[error],
      onChange: (event: { target: { value: string } }) => {
        edited.current.add(field)
        const next = { ...values, [field]: event.target.value }
        setValues(next)
        if (attempted) setErrors(validate(next))
      },
    }
  }

  const onSubmit =
    (action: (values: Record<Field, string>) => Promise<void>) =>
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (inFlight.current) return
      setAttempted(true)
      const nextErrors = validate(values)
      setErrors(nextErrors)

      const firstInvalid = (Object.keys(initial) as Field[]).find(
        (field) => nextErrors[field],
      )
      if (firstInvalid) {
        setStatus({ tone: "error", message: INVALID })
        formRef.current
          ?.querySelector<HTMLElement>(`#${CSS.escape(fieldId(firstInvalid))}`)
          ?.focus()
        return
      }

      inFlight.current = true
      setSubmitting(true)
      setStatus(null)
      try {
        await action(values)
      } finally {
        inFlight.current = false
        setSubmitting(false)
      }
    }

  /**
   * Fills fields that are empty and that the visitor has not typed in (a
   * field they cleared stays clear), e.g. from the signed-in account.
   */
  const prefill = useCallback((known: Partial<Record<Field, string>>) => {
    setValues((current) => {
      let changed = false
      const next = { ...current }
      for (const field of Object.keys(known) as Field[]) {
        const value = known[field]
        if (value && !edited.current.has(field) && !current[field].trim()) {
          next[field] = value
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [])

  return {
    baseId,
    prefill,
    formRef,
    values,
    fieldProps,
    submitting,
    status,
    /** The status message in the current language ("" when none). */
    statusText: status ? status.message(t) : "",
    setStatus,
    onSubmit,
  }
}
