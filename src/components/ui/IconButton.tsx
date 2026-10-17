import type { ComponentPropsWithoutRef } from "react"
import AppLink from "./AppLink"
import Icon, { type IconName } from "./Icon"
import "./IconButton.css"

interface IconControlProps {
  /** Omit for a text-only control (pair with `alwaysShowLabel` so it stays visible on mobile). */
  icon?: IconName
  label: string
  /** Small superscript value, e.g. the bag count. Decorative; include it in `aria-label` when it matters. */
  badge?: string | number
  /** Keep the text label visible on small screens instead of collapsing to icon-only. */
  alwaysShowLabel?: boolean
}

interface IconButtonAsButton
  extends IconControlProps,
    Omit<ComponentPropsWithoutRef<"button">, "children"> {
  href?: undefined
}

/** With `href`, renders the same control as a link (e.g. Account, Bag). */
interface IconButtonAsLink
  extends IconControlProps,
    Omit<ComponentPropsWithoutRef<"a">, "children" | "href"> {
  href: string
}

type IconButtonProps = IconButtonAsButton | IconButtonAsLink

/**
 * Monoline icon with a text label. On mobile the label collapses to icon-only
 * but stays available to assistive technology.
 */
export default function IconButton(props: IconButtonProps) {
  const { icon, label, badge, alwaysShowLabel = false, className } = props
  const classes = [
    "icon-button",
    alwaysShowLabel ? "" : "icon-button--collapsible",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  const content = (
    <>
      {icon && <Icon name={icon} />}
      <span className="icon-button__label">{label}</span>
      {badge !== undefined && (
        <sup className="icon-button__badge" aria-hidden="true">
          {badge}
        </sup>
      )}
    </>
  )

  if (props.href !== undefined) {
    const {
      icon: _i,
      label: _l,
      badge: _b,
      alwaysShowLabel: _a,
      ...linkProps
    } = props
    return (
      <AppLink {...linkProps} className={classes}>
        {content}
      </AppLink>
    )
  }

  const {
    icon: _i,
    label: _l,
    badge: _b,
    alwaysShowLabel: _a,
    type = "button",
    ...buttonProps
  } = props
  return (
    <button {...buttonProps} type={type} className={classes}>
      {content}
    </button>
  )
}
