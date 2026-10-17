import type { ReactNode } from "react"
import type { PageIntroContent } from "@/types/content"
import "@/pages/AuthPage.css"

interface AuthLayoutProps {
  intro: PageIntroContent
  /** Short serif line beside the form, as on the Contact page. */
  note: string
  /** Links under the note, e.g. "Create an account". */
  aside?: ReactNode
  children: ReactNode
}

/** Shared frame for the sign-in, sign-up and password pages. */
export default function AuthLayout({
  intro,
  note,
  aside,
  children,
}: AuthLayoutProps) {
  return (
    <div className="auth-page">
      {/* Framed still life; decorative, so it stays out of the reading order. */}
      <div className="auth-editorial" aria-hidden="true">
        <div className="auth-editorial__frame">
          <img
            src="/images/auth/auth-editorial-1024.webp"
            srcSet="/images/auth/auth-editorial-640.webp 640w, /images/auth/auth-editorial-1024.webp 1024w"
            sizes="(max-width: 1023px) 100vw, 46vw"
            alt=""
            width="1024"
            height="1536"
            fetchPriority="high"
          />
        </div>
      </div>

      <section className="auth-panel">
        <div className="auth-panel__inner">
          <header className="auth-intro">
            <p className="eyebrow">{intro.eyebrow}</p>
            <h1>{intro.title}</h1>
            {intro.lead && <p className="auth-intro__lead">{intro.lead}</p>}
          </header>
          <div className="auth-body">{children}</div>
          <div className="auth-aside">
            <p className="auth-aside__note">{note}</p>
            {aside && <div className="auth-aside__links">{aside}</div>}
          </div>
        </div>
      </section>
    </div>
  )
}

/** Inline status under a submit button; announced politely. */
export function AuthStatus({
  id,
  tone,
  children,
}: {
  id?: string
  tone?: "info" | "error"
  children?: ReactNode
}) {
  return (
    <p
      id={id}
      className={`auth-status${tone === "error" ? " is-error" : ""}`}
      role="status"
    >
      {children}
    </p>
  )
}
