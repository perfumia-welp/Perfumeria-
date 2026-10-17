import type { ReactNode } from "react"

export type IconName = "search" | "account" | "bag" | "arrow" | "chevron" | "menu" | "close" | "pause" | "play" | "drop" | "seal" | "heart" | "instagram" | "reel" | "mail"

const paths: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.4" />
      <path d="m16 16 4 4" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="3.7" />
      <path d="M5.5 20c.5-4.1 2.7-6.2 6.5-6.2s6 2.1 6.5 6.2" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8.5h14l-1 12H6l-1-12Z" />
      <path d="M8.8 9V6.7a3.2 3.2 0 0 1 6.4 0V9" />
    </>
  ),
  arrow: <path d="M4 12h15M14 7l5 5-5 5" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  menu: <path d="M4 9h16M4 15h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  pause: <path d="M9 6v12M15 6v12" />,
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  drop: (
    <>
      <path d="M12 3.5S6.5 9.6 6.5 14a5.5 5.5 0 0 0 11 0c0-4.4-5.5-10.5-5.5-10.5Z" />
      <path d="M9.5 15.2c.3 1.3 1.1 2 2.5 2.3" />
    </>
  ),
  seal: (
    <>
      <circle cx="12" cy="10.5" r="6.5" />
      <path d="m8.3 15.8-.8 5 4.5-2.6 4.5 2.6-.8-5M9.5 10.7l1.7 1.7 3.5-3.8" />
    </>
  ),
  heart: (
    <path d="M20 8.8c0 5-8 10.2-8 10.2S4 13.8 4 8.8C4 6.2 5.8 4.5 8.2 4.5c1.6 0 3 1 3.8 2.2.8-1.2 2.2-2.2 3.8-2.2C18.2 4.5 20 6.2 20 8.8Z" />
  ),
  instagram: (
    <>
      <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="4.6" />
      <circle cx="12" cy="12" r="3.9" />
      <path d="M16.9 7.1h.01" />
    </>
  ),
  /* A reel: a frame with a film strip along the top and a play mark. */
  reel: (
    <>
      <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="4" />
      <path d="M3.8 8.8h16.4M8.6 3.8l2.4 5M13.4 3.8l2.4 5M10.4 12.2v4.6l4-2.3-4-2.3Z" />
    </>
  ),
  mail: (
    <>
      <rect x="3.8" y="5.8" width="16.4" height="12.4" />
      <path d="m4.2 6.6 7.8 6.2 7.8-6.2" />
    </>
  ),
}

/** Icons that point along the reading direction (forward, next). */
const DIRECTIONAL: IconName[] = ["arrow", "chevron"]

/**
 * Monoline 24×24 icon. Size is controlled in CSS through `--icon-size`.
 * Directional icons are mirrored in right-to-left pages (styles/rtl.css), on
 * an inner group so CSS transforms on the icon itself (hover nudges, the
 * 180° "previous" turn) still apply on top. Pass `mirror={false}` for an
 * icon used vertically, such as a dropdown chevron.
 */
export default function Icon({
  name,
  className,
  mirror = DIRECTIONAL.includes(name),
}: {
  name: IconName
  className?: string
  mirror?: boolean
}) {
  const classes = ["icon", mirror && "icon--mirror", className]
    .filter(Boolean)
    .join(" ")
  return (
    <svg
      className={classes}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {mirror ? <g className="icon__glyph">{paths[name]}</g> : paths[name]}
    </svg>
  )
}
