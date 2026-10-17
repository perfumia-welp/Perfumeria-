import type { ReactNode } from "react"
import { whatsappChatUrl, whatsappDigits } from "@/config/company"
import type { Messages } from "@/i18n/messages"
import { paths } from "@/router/paths"
import Icon from "../ui/Icon"
import SocialIcon from "../ui/SocialIcon"

/**
 * One primary action of the contact launcher. It either leads somewhere
 * (`href`: a site path stays in the site, anything else opens in a new tab)
 * or runs `onSelect`, e.g. to open a live-chat provider's own window.
 */
export interface ContactAction {
  id: string
  icon: ReactNode
  label: string
  hint: string
  href?: string
  onSelect?: () => void
}

/*
 * The launcher's primary actions, in display order. "Chat with us" is a
 * WhatsApp conversation for now; to move to a live-chat provider, replace
 * that entry's `href` with an `onSelect` that opens the provider. The
 * launcher itself does not change.
 */
export function getContactActions(t: Messages): ContactAction[] {
  const copy = t.contactLauncher.actions
  const actions: ContactAction[] = []

  if (whatsappDigits)
    actions.push({
      id: "chat",
      icon: <SocialIcon platform="whatsapp" />,
      label: copy.chat.label,
      hint: copy.chat.hint,
      href: whatsappChatUrl,
    })

  actions.push({
    id: "contact",
    icon: <Icon name="mail" />,
    label: copy.contact.label,
    hint: copy.contact.hint,
    href: paths.contact,
  })

  return actions
}
