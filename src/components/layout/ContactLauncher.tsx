import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from "react"
import { useI18n } from "@/i18n/i18nContext"
import type { SocialLink } from "@/types/content"
import AppLink from "../ui/AppLink"
import Icon from "../ui/Icon"
import SocialIcon from "../ui/SocialIcon"
import { getContactActions, type ContactAction } from "./contactActions"
import SupportAvatar from "./SupportAvatar"
import "./ContactLauncher.css"

/** A short pause before a hover opens the panel, so passing over it does nothing. */
const HOVER_OPEN_MS = 120
/** Time to travel between the launcher and the panel before a hover preview closes. */
const HOVER_CLOSE_MS = 260

const isSitePath = (href: string) => href.startsWith("/")

interface ContactLauncherProps {
  /** Accounts for the "Follow" row. */
  socialLinks: SocialLink[]
  newTabLabel: string
}

function ActionRow({
  action,
  newTabLabel,
  onDone,
}: {
  action: ContactAction
  newTabLabel: string
  onDone: () => void
}) {
  const body = (
    <>
      <span className="contact-launcher__action-icon">{action.icon}</span>
      <span className="contact-launcher__action-text">
        <strong>{action.label}</strong> <span>{action.hint}</span>
      </span>
      <Icon name="arrow" className="contact-launcher__action-arrow" />
    </>
  )

  if (!action.href) {
    const select = () => {
      onDone()
      action.onSelect?.()
    }
    return (
      <button
        type="button"
        className="contact-launcher__action"
        onClick={select}
      >
        {body}
      </button>
    )
  }

  if (isSitePath(action.href))
    return (
      <AppLink
        href={action.href}
        className="contact-launcher__action"
        onClick={onDone}
      >
        {body}
      </AppLink>
    )

  return (
    <a
      href={action.href}
      className="contact-launcher__action"
      target="_blank"
      rel="noopener noreferrer"
      onClick={onDone}
    >
      {body}
      <span className="visually-hidden"> ({newTabLabel})</span>
    </a>
  )
}

/**
 * Floating contact launcher: one support pill (agent portrait, "Need help?")
 * fixed at the end corner of the viewport that discloses a small panel with the ways to reach the company.
 *
 * The panel is open while it is pinned (a click, tap or keyboard press on the
 * launcher) or previewed (a mouse resting on the launcher or the panel).
 * Clicking outside, Escape, moving focus out of it or choosing an action
 * closes it.
 */
export default function ContactLauncher({
  socialLinks,
  newTabLabel,
}: ContactLauncherProps) {
  const { t } = useI18n()
  const copy = t.contactLauncher
  const actions = useMemo(() => getContactActions(t), [t])

  const [pinned, setPinned] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const open = pinned || previewing

  const rootRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const hoverTimer = useRef<number | undefined>(undefined)
  const panelId = useId()
  const headingId = useId()

  const close = useCallback(() => {
    window.clearTimeout(hoverTimer.current)
    setPinned(false)
    setPreviewing(false)
  }, [])

  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  useEffect(() => {
    if (!open) return

    const closeOnOutsidePress = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      // Focus inside the panel would be lost with it; hand it back.
      if (rootRef.current?.contains(document.activeElement))
        toggleRef.current?.focus()
      close()
    }

    document.addEventListener("pointerdown", closeOnOutsidePress)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [open, close])

  const toggle = () => {
    if (pinned) close()
    else {
      window.clearTimeout(hoverTimer.current)
      setPinned(true)
    }
  }

  // Hover is a mouse-only convenience; touch and pen open with a tap.
  const preview = (next: boolean) => (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return
    window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(
      () => setPreviewing(next),
      next ? HOVER_OPEN_MS : HOVER_CLOSE_MS,
    )
  }

  // Tabbing past the last link (or back past the launcher) closes the panel.
  const closeOnFocusOut = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && !event.currentTarget.contains(next)) close()
  }

  const classes = ["contact-launcher", open && "is-open", pinned && "is-pinned"]
    .filter(Boolean)
    .join(" ")

  return (
    <>
      <aside
        ref={rootRef}
        className={classes}
        aria-label={copy.label}
        onPointerEnter={preview(true)}
        onPointerLeave={preview(false)}
        onBlur={closeOnFocusOut}
      >
        <button
          ref={toggleRef}
          type="button"
          className="contact-launcher__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
        >
          <span className="contact-launcher__avatar" aria-hidden="true">
            <SupportAvatar />
            <span className="contact-launcher__status" />
          </span>
          <span className="contact-launcher__text">
            <strong>{copy.launcher.title}</strong>{" "}
            <span>{copy.launcher.subtitle}</span>
          </span>
          <Icon
            name="chevron"
            mirror={false}
            className="contact-launcher__chevron"
          />
        </button>

        <div
          id={panelId}
          className="contact-launcher__panel"
          role="group"
          aria-labelledby={headingId}
          inert={!open}
        >
          <h2 id={headingId} className="contact-launcher__title">
            {copy.heading}
          </h2>
          <p className="contact-launcher__intro">{copy.intro}</p>

          <ul className="contact-launcher__actions">
            {actions.map((action) => (
              <li key={action.id}>
                <ActionRow
                  action={action}
                  newTabLabel={newTabLabel}
                  onDone={close}
                />
              </li>
            ))}
          </ul>

          <div className="contact-launcher__follow">
            <p>{copy.follow}</p>
            <ul>
              {socialLinks.map((link) => (
                <li key={link.platform}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${link.label} (${newTabLabel})`}
                    title={link.label}
                    onClick={close}
                  >
                    <SocialIcon platform={link.platform} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
      <a
        className="mobile-whatsapp"
        href="https://wa.me/201278166686"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${copy.actions.chat.label} (${copy.actions.chat.hint})`}
      >
        <SocialIcon platform="whatsapp" />
        <span>{copy.actions.chat.label}</span>
      </a>
    </>
  )
}
