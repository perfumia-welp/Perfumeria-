import type { Messages } from "@/i18n/messages"
import type { SiteContact } from "@/services/siteContact"
import type { ContactDetail } from "@/types/commerce"

/*
 * Contact details shown on the Contact page, from GET /api/site-contact
 * (useSiteContact): the public mailbox and the WhatsApp number, which the
 * server reads from the merchant's Welp record. The values themselves are
 * never written here. Customer care hours are not shown: the company has not
 * confirmed them, and the placeholder wording (contact.details.hoursLines)
 * must not appear as real hours. The values are the same in every language.
 */
export function getContactDetails(
  t: Messages,
  contact: SiteContact,
): ContactDetail[] {
  const labels = t.contact.details
  return [
    {
      label: labels.email,
      lines: [contact.email],
      href: `mailto:${contact.email}`,
    },
    {
      label: labels.phone,
      lines: [contact.phoneDisplay],
      href: contact.phoneHref,
      ltr: true,
    },
  ]
}
