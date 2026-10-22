/*
 * Contact form submissions: validation and the email sent to the store.
 *
 * Everything here is plain functions so it can be tested without a network:
 * server/app.mjs wires them to POST /api/contact and the SMTP transport.
 *
 * The visitor's text is only ever used as data: it is trimmed, length
 * limited, stripped of control characters for headers, and HTML-escaped in
 * the HTML part. The visitor's address is the Reply-To, never the From.
 */

/** Topics the site links to (src/router/paths.ts CONTACT_TOPICS). */
export const CONTACT_TOPICS = ["wholesale", "track-order"]

export const LOCALES = ["en", "ar"]

/** Subject line per inquiry type, so the inbox can sort them at a glance. */
const SUBJECTS = {
  general: "Perfumira Website – Contact Inquiry",
  wholesale: "Perfumira Website – Wholesale Inquiry",
  "track-order": "Perfumira Website – Track Order Request",
}

const TOPIC_LABELS = {
  general: "General inquiry",
  wholesale: "Wholesale",
  "track-order": "Track order",
}

const LOCALE_LABELS = { en: "English", ar: "Arabic" }

/** Maximum lengths after trimming. Generous: real messages never get close. */
export const LIMITS = {
  fullName: 120,
  email: 254,
  phone: 40,
  subject: 200,
  message: 5000,
  pageUrl: 500,
}

/** Same rules as src/lib/validation.ts, so both sides agree. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_PATTERN = /^\+?[\d\s()-]{6,}$/

/** Name of the hidden field that people never see and bots fill in. */
export const HONEYPOT_FIELD = "nectar"

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value)

/** Removes control characters except tab and newline (message text keeps its lines). */
const stripControls = (value) =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")

/** A single-line value: no newlines at all (names, subjects, header values). */
const singleLine = (value) => stripControls(value).replace(/\s+/g, " ").trim()

/**
 * Checks a request body. Returns `{ ok: true, value }` with clean values, or
 * `{ ok: false, error, fields }` where `fields` names the invalid fields.
 * `error` is "invalid_request" for a malformed body or the honeypot.
 */
export function validateContact(body) {
  if (!isPlainObject(body)) return { ok: false, error: "invalid_request" }

  const text = (key) => (typeof body[key] === "string" ? body[key] : null)
  const known = [
    "fullName",
    "email",
    "phone",
    "subject",
    "message",
    "topic",
    "locale",
    "pageUrl",
    HONEYPOT_FIELD,
  ]
  // Every value that is present must be a string.
  for (const key of known) {
    if (body[key] !== undefined && body[key] !== null && text(key) === null)
      return { ok: false, error: "invalid_request" }
  }

  // Filled in: almost certainly an automated submission.
  if ((text(HONEYPOT_FIELD) ?? "").trim())
    return { ok: false, error: "invalid_request" }

  const value = {
    fullName: singleLine(text("fullName") ?? ""),
    email: (text("email") ?? "").trim(),
    phone: singleLine(text("phone") ?? ""),
    subject: singleLine(text("subject") ?? ""),
    message: stripControls(text("message") ?? "").trim(),
    topic: (text("topic") ?? "").trim() || null,
    locale: (text("locale") ?? "").trim() || "en",
    pageUrl: (text("pageUrl") ?? "").trim(),
  }

  const fields = []
  if (!value.fullName || value.fullName.length > LIMITS.fullName)
    fields.push("fullName")
  if (
    !value.email ||
    value.email.length > LIMITS.email ||
    !EMAIL_PATTERN.test(value.email)
  )
    fields.push("email")
  if (
    value.phone &&
    (value.phone.length > LIMITS.phone ||
      !PHONE_PATTERN.test(value.phone) ||
      value.phone.replace(/\D/g, "").length < 7)
  )
    fields.push("phone")
  if (!value.subject || value.subject.length > LIMITS.subject)
    fields.push("subject")
  if (!value.message || value.message.length > LIMITS.message)
    fields.push("message")
  if (value.topic !== null && !CONTACT_TOPICS.includes(value.topic))
    fields.push("topic")
  if (!LOCALES.includes(value.locale)) fields.push("locale")

  // Page URL is context only: keep it when it is a normal web address.
  if (value.pageUrl) {
    try {
      const url = new URL(value.pageUrl)
      if (
        !["http:", "https:"].includes(url.protocol) ||
        value.pageUrl.length > LIMITS.pageUrl
      )
        value.pageUrl = ""
    } catch {
      value.pageUrl = ""
    }
  }

  if (fields.length) return { ok: false, error: "validation", fields }
  return { ok: true, value }
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** The store's local time, plus the exact UTC time. */
function formatTimestamp(date) {
  const cairo = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date)
  return `${cairo} (Cairo) · ${date.toISOString()}`
}

/**
 * Builds the email for a validated submission. `from` and `to` come from the
 * server configuration only, never from the request.
 */
export function buildContactEmail(value, { from, to, now = new Date() }) {
  const topic = value.topic ?? "general"
  const subject = `${SUBJECTS[topic]} – ${value.fullName}`

  // Only fields the visitor actually submitted (phone and page are optional).
  const rows = [
    ["Name", value.fullName],
    ["Email", value.email],
    ["Phone", value.phone],
    ["Topic", TOPIC_LABELS[topic]],
    ["Subject", value.subject],
    ["Language", LOCALE_LABELS[value.locale]],
    ["Page", value.pageUrl],
    ["Submitted", formatTimestamp(now)],
  ].filter(([, field]) => field)

  const text = [
    `New message from the Perfumira website (${TOPIC_LABELS[topic]}).`,
    "",
    ...rows.map(([label, field]) => `${label}: ${field}`),
    "",
    "Message:",
    value.message,
    "",
    "Reply to this email to answer the customer directly.",
  ].join("\n")

  const cell =
    "padding:8px 12px;border-bottom:1px solid #e8e2d8;vertical-align:top"
  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1f1b16">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e8e2d8">
    <tr><td style="padding:20px 24px;border-bottom:1px solid #e8e2d8">
      <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a7a62">Perfumira website</p>
      <h1 style="margin:6px 0 0;font-size:20px;font-weight:normal">${escapeHtml(SUBJECTS[topic])}</h1>
    </td></tr>
    <tr><td style="padding:8px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5">
${rows
  .map(
    ([label, field]) =>
      `        <tr><th align="left" style="${cell};width:120px;color:#8a7a62;font-weight:normal">${escapeHtml(label)}</th><td style="${cell}">${escapeHtml(field)}</td></tr>`,
  )
  .join("\n")}
      </table>
    </td></tr>
    <tr><td style="padding:16px 24px 24px">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a7a62">Message</p>
      <div dir="auto" style="font-size:15px;line-height:1.6;white-space:pre-wrap">${escapeHtml(value.message)}</div>
    </td></tr>
    <tr><td style="padding:12px 24px;border-top:1px solid #e8e2d8;font-size:12px;color:#8a7a62">Reply to this email to answer the customer directly.</td></tr>
  </table>
</body>
</html>`

  return {
    from,
    to,
    // Nodemailer encodes the display name; the address passed validation,
    // which allows no whitespace, so it cannot carry extra header lines.
    replyTo: { name: value.fullName, address: value.email },
    subject,
    text,
    html,
  }
}
