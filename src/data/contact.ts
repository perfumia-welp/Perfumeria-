import type { Messages } from "@/i18n/messages"
import type { ContactDetail } from "@/types/commerce"

/*
 * PLACEHOLDER BUSINESS DETAILS — replace with the company's confirmed email,
 * phone number and opening hours before launch. Kept here, in one place,
 * so no component carries invented contact information. The values are the
 * same in every language; labels and the hours wording come from messages.
 */
const SUPPORT_EMAIL = "support@perfumeria.com"
const PHONE = "+XX XXX XXX XXXX"

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
      ltr: true,
    },
    {
      label: labels.hours,
      lines: labels.hoursLines,
    },
  ]
}
