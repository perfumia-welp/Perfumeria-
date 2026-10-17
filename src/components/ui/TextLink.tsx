import type { NavigationItem } from "@/types/content"
import AppLink from "./AppLink"
import Icon from "./Icon"
import "./TextLink.css"

export default function TextLink({
  link,
  onClick,
}: {
  link: NavigationItem
  onClick?: () => void
}) {
  return (
    <AppLink className="text-link" href={link.href} onClick={onClick}>
      <span>{link.label}</span>
      <Icon name="arrow" />
    </AppLink>
  )
}
