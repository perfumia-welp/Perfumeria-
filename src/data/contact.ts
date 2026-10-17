import type { Messages } from "@/i18n/messages"
import type { ContactDetail } from "@/types/commerce"
import { company } from "@/config/company"

/*
 * Contact details shown on the Contact page, from the owner-confirmed company
 * settings (config/company.ts): the order inbox and the WhatsApp number.
 * The hours wording (contact.details.hoursLines) is still a PLACEHOLDER until
 * the company confirms its hours. The values are the same in every language.
 */
const SUPPORT_EMAIL = company.orderEmail
const PHONE = company.whatsappNumber.replace(
  /^\+20(\d{3})(\d{3})(\d{4})$/,
  "+20 $1 $2 $3",
)

export function getContactDetails(t: Messages): ContactDetail[] {
  const labels = t.contact.details
  return [
    {
      label: labels.email,
      lines: [SUPPORT_EMAIL],
      href: `mailto:${SUPPORT_EMAIL}`,
    },
    {
      label: labels.phone,
      lines: [PHONE],
      href: `tel:+${company.whatsappNumber.replace(/\D/g, "")}`,
      ltr: true,
    },
    {
      label: labels.hours,
      lines: labels.hoursLines,
    },
  ]
}
