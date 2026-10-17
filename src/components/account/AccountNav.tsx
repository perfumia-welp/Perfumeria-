import { useRef, useState } from "react"
import { NavLink } from "react-router"
import { useAuth } from "@/auth/authContext"
import type { AuthErrorCode } from "@/auth/authErrors"
import { useI18n } from "@/i18n/i18nContext"
import SignOutDialog from "./SignOutDialog"
import "../ui/UnavailableAction.css"

/** Route navigation for the account area, plus the Sign Out action. */
export default function AccountNav() {
  const { signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const signOutButtonRef = useRef<HTMLButtonElement>(null)
  /** Sign-out failure, translated when shown. */
  const [notice, setNotice] = useState<AuthErrorCode | null>(null)
  const { t } = useI18n()
  const copy = t.account.nav
  const links = [
    { to: ".", label: copy.overview, end: true },
    { to: "orders", label: copy.orders },
    { to: "wishlist", label: copy.wishlist },
    { to: "addresses", label: copy.addresses },
    { to: "details", label: copy.details },
  ]

  // On success RequireAuth sees the session end and moves to the homepage.
  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    setNotice(null)
    const result = await signOut()
    if (!result.ok) {
      setSigningOut(false)
      setNotice(result.error)
    }
  }

  return (
    <nav className="account-nav" aria-label={copy.label}>
      <ul>
        {links.map((link) => (
          <li key={link.to}>
            <NavLink to={link.to} end={link.end} preventScrollReset>
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <span className="unavailable-action account-nav__sign-out">
        <button
          ref={signOutButtonRef}
          type="button"
          className="unavailable-action__plain"
          disabled={signingOut}
          onClick={() => {
            setNotice(null)
            setConfirmingSignOut(true)
          }}
        >
          {signingOut ? copy.signingOut : copy.signOut}
        </button>
        <span className="unavailable-action__notice" role="status">
          {notice && t.auth.errors[notice]}
        </span>
      </span>
      <SignOutDialog
        open={confirmingSignOut}
        title={t.account.signOutDialog.title}
        message={t.account.signOutDialog.message}
        cancelLabel={t.account.signOutDialog.cancel}
        confirmLabel={copy.signOut}
        busyLabel={copy.signingOut}
        busy={signingOut}
        errorText={notice ? t.auth.errors[notice] : undefined}
        onClose={() => {
          setConfirmingSignOut(false)
          signOutButtonRef.current?.focus()
        }}
        onConfirm={handleSignOut}
      />
    </nav>
  )
}
