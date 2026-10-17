import {
  useEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react"
import "./Sheet.css"

export type SheetVariant = "fullscreen" | "top" | "side"

interface SheetProps {
  open: boolean
  onClose: () => void
  /** Accessible name of the dialog. */
  label: string
  variant: SheetVariant
  id?: string
  className?: string
  /** Close automatically when this media query starts matching (e.g. the desktop layout). */
  closeWhen?: string
  /** Close when the dimmed area outside the panel is clicked. */
  dismissOnBackdrop?: boolean
  /** Element to focus when the sheet opens; defaults to the first focusable element. */
  initialFocus?: RefObject<HTMLElement | null>
  /** Receives `close`, which closes synchronously (useful before a link navigates). */
  children: (close: () => void) => ReactNode
}

/**
 * Accessible overlay built on the native modal <dialog>: the browser provides
 * focus containment, Escape to close, background inertness and focus return.
 * Page scroll is locked by `html:has(dialog[open])` in base.css.
 */
export default function Sheet({
  open,
  onClose,
  label,
  variant,
  id,
  className,
  closeWhen,
  dismissOnBackdrop = false,
  initialFocus,
  children,
}: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      initialFocus?.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open, initialFocus])

  useEffect(() => {
    if (!open || !closeWhen) return
    const query = window.matchMedia(closeWhen)
    const closeOnMatch = () => query.matches && dialogRef.current?.close()
    query.addEventListener("change", closeOnMatch)
    return () => query.removeEventListener("change", closeOnMatch)
  }, [open, closeWhen])

  const close = () => dialogRef.current?.close()

  // A click whose target is the <dialog> itself landed on the backdrop, outside the panel.
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (dismissOnBackdrop && event.target === event.currentTarget) close()
  }

  const classes = ["sheet", `sheet--${variant}`, className]
    .filter(Boolean)
    .join(" ")

  return (
    <dialog
      ref={dialogRef}
      id={id}
      className={classes}
      aria-label={label}
      onClose={onClose}
      onClick={handleClick}
    >
      {children(close)}
    </dialog>
  )
}
