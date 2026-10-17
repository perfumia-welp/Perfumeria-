import {
  useEffect,
  useId,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import Icon from "../ui/Icon"
import "./FilterMenu.css"

interface FilterMenuProps {
  label: string
  /** Short state shown after the label, e.g. "2" or "Featured". */
  value?: string
  /** Screen-reader wording after the value, e.g. "selected". */
  valueDescription?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  align?: "start" | "end"
  className?: string
  children: ReactNode
}

/**
 * Disclosure dropdown for a filter or sort group. Closes on Escape (returning
 * focus to its button), on an outside click, or when focus leaves it.
 */
export default function FilterMenu({
  label,
  value,
  valueDescription,
  open,
  onOpenChange,
  align = "start",
  className,
  children,
}: FilterMenuProps) {
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // If the panel closes while focus is inside it (e.g. after choosing a sort
  // option), return focus to the button instead of losing it.
  useEffect(() => {
    if (!open && panelRef.current?.contains(document.activeElement)) {
      buttonRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false)
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer)
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer)
  }, [open, onOpenChange])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !open) return
    event.stopPropagation()
    onOpenChange(false)
    buttonRef.current?.focus()
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (
      open &&
      !rootRef.current?.contains(event.relatedTarget as Node | null)
    ) {
      onOpenChange(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className={["filter-menu", className].filter(Boolean).join(" ")}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <button
        ref={buttonRef}
        type="button"
        className="filter-menu__button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
      >
        <span>{label}</span>
        {value && (
          <span className="filter-menu__value">
            {value}
            {valueDescription && (
              <span className="visually-hidden"> {valueDescription}</span>
            )}
          </span>
        )}
        <Icon name="chevron" className="filter-menu__chevron" mirror={false} />
      </button>
      <div
        ref={panelRef}
        id={panelId}
        className={`filter-menu__panel filter-menu__panel--${align}`}
        hidden={!open}
      >
        {children}
      </div>
    </div>
  )
}
