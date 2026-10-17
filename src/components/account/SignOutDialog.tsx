import { useEffect, useRef, type MouseEvent } from "react"
import "./SignOutDialog.css"

interface SignOutDialogProps {
  open: boolean
  title: string
  message: string
  cancelLabel: string
  confirmLabel: string
  busyLabel: string
  busy: boolean
  errorText?: string
  onClose: () => void
  onConfirm: () => void
}

/** Native modal dialog: focus trap, page inertness, and Escape are browser-managed. */
export default function SignOutDialog({
  open,
  title,
  message,
  cancelLabel,
  confirmLabel,
  busyLabel,
  busy,
  errorText,
  onClose,
  onConfirm,
}: SignOutDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const close = () => {
    if (!busy) dialogRef.current?.close()
  }

  const handleBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) close()
  }

  return (
    <dialog
      ref={dialogRef}
      className="sign-out-dialog"
      aria-labelledby="sign-out-dialog-title"
      aria-describedby="sign-out-dialog-message"
      onCancel={(event) => busy && event.preventDefault()}
      onClose={onClose}
      onClick={handleBackdrop}
    >
      <div className="sign-out-dialog__panel">
        <h2 id="sign-out-dialog-title">{title}</h2>
        <p id="sign-out-dialog-message" className="sign-out-dialog__message">
          {message}
        </p>
        <div className="sign-out-dialog__actions">
          <button
            ref={cancelRef}
            type="button"
            className="sign-out-dialog__cancel"
            disabled={busy}
            onClick={close}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="button-primary sign-out-dialog__confirm"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
        <p className="sign-out-dialog__status" role="status">
          {errorText}
        </p>
      </div>
    </dialog>
  )
}
