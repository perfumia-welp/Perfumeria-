import { useState } from "react"
import { useI18n } from "@/i18n/i18nContext"
import type { ServiceResult } from "@/types/commerce"
import Icon from "./Icon"
import "./UnavailableAction.css"

/**
 * A text-link styled action whose backend may not exist yet. It calls
 * `onAction`; if the service reports "unavailable" it shows `message`
 * inline (announced politely) instead of pretending to succeed. The outcome
 * is kept rather than its text, so the notice follows a language switch.
 */
interface UnavailableActionProps {
  label: string
  /** Fuller name for assistive technology, e.g. "View order #PF-10324". */
  accessibleLabel?: string
  message: string
  onAction: () => Promise<ServiceResult>
  withArrow?: boolean
  className?: string
}

export default function UnavailableAction({
  label,
  accessibleLabel,
  message,
  onAction,
  withArrow = true,
  className,
}: UnavailableActionProps) {
  const [outcome, setOutcome] = useState<ServiceResult["status"] | null>(null)
  const { t } = useI18n()

  const handleClick = async () => {
    const result = await onAction()
    setOutcome(result.status)
  }

  const notice =
    outcome === "unavailable"
      ? message
      : outcome === "error"
        ? t.common.genericError
        : ""

  return (
    <span
      className={["unavailable-action", className].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className={withArrow ? "text-link" : "unavailable-action__plain"}
        aria-label={accessibleLabel}
        onClick={handleClick}
      >
        <span>{label}</span>
        {withArrow && <Icon name="arrow" />}
      </button>
      <span className="unavailable-action__notice" role="status">
        {notice}
      </span>
    </span>
  )
}
