/*
 * Company settings used by checkout and the social links. Keep these here,
 * never inside components.
 *
 * PLACEHOLDERS: replace before launch.
 */
export const company = {
  name: "Perfumira",

  /**
   * WhatsApp number that receives order requests, in international format
   * with country code, e.g. "+20 100 000 0000". Spaces, dashes and "+" are
   * stripped for the wa.me link. Empty = WhatsApp ordering not set up yet.
   * Confirmed by the store owner 2026-10-08.
   */
  whatsappNumber: "+201278166686",

  /**
   * The store's public email (Titan mailbox), shown on the Contact page, in
   * the structured data and as the checkout mailto fallback. Server-sent mail
   * is addressed by the server's MAIL_TO setting (server.mjs), never by this
   * value. Official address since 2026-10-22.
   */
  orderEmail: "info@perfumira.net",

  /**
   * Set to true once supabase/functions/send-order-request is deployed with
   * its secrets (RESEND_API_KEY, ORDER_EMAIL_TO, ORDER_EMAIL_FROM). While
   * false, checkout says email delivery is not configured and skips the call.
   */
  orderEmailEnabled: false,

  /** Instagram handle as shown on the site. */
  instagramHandle: "@perfumiraegy",

  /** The company's social accounts. Supplied by the client 2026-10-11. */
  social: {
    instagram: "https://www.instagram.com/perfumiraegy",
    facebook: "https://www.facebook.com/perfumiraegy",
    tiktok: "https://www.tiktok.com/@perfumiraegy",
    telegram: "https://t.me/perfumiraeg",
  },
}

/** Digits only, as wa.me expects; empty when no number is configured. */
export const whatsappDigits = company.whatsappNumber.replace(/\D/g, "")

/** WhatsApp chat with the company (no prefilled message). */
export const whatsappChatUrl = `https://wa.me/${whatsappDigits}`
