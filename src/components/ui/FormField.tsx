import type {
  ComponentPropsWithoutRef,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react"
import { useI18n } from "@/i18n/i18nContext"
import "./FormField.css"

interface FormFieldBaseProps {
  id: string
  label: string
  /** Shown under the field and linked with aria-describedby. */
  error?: string
  /** Adds a quiet "Optional" note; required fields are the default. */
  optional?: boolean
  className?: string
}

interface InputFieldProps
  extends FormFieldBaseProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> {
  multiline?: false
}

interface TextareaFieldProps
  extends FormFieldBaseProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className"> {
  multiline: true
}

type FormFieldProps = InputFieldProps | TextareaFieldProps

/** Values written left to right in every language (email, phone). */
const LTR_TYPES = ["email", "tel"]

/**
 * Labelled input or textarea with an underline style and inline error.
 * Email and phone values stay left-to-right inside Arabic forms.
 */
export default function FormField(props: FormFieldProps) {
  const { id, label, error, optional, className } = props
  const { t } = useI18n()
  const errorId = `${id}-error`
  const isLtrValue = !props.multiline && LTR_TYPES.includes(props.type ?? "")
  const shared = {
    id,
    dir: props.dir ?? (isLtrValue ? "ltr" : undefined),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    required: optional ? undefined : true,
  }

  let control
  if (props.multiline) {
    const {
      id: _id,
      label: _label,
      error: _error,
      optional: _optional,
      className: _className,
      multiline: _multiline,
      ...textareaProps
    } = props
    control = <textarea {...textareaProps} {...shared} />
  } else {
    const {
      id: _id,
      label: _label,
      error: _error,
      optional: _optional,
      className: _className,
      multiline: _multiline,
      ...inputProps
    } = props
    control = (
      <input {...inputProps as ComponentPropsWithoutRef<"input">} {...shared} />
    )
  }

  return (
    <div
      className={["form-field", error ? "is-invalid" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      <label htmlFor={id}>
        {label}
        {optional && (
          <span className="form-field__optional">{t.common.optional}</span>
        )}
      </label>
      {control}
      {error && (
        <p id={errorId} className="form-field__error">
          {error}
        </p>
      )}
    </div>
  )
}
