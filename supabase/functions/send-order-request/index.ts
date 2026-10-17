/*
 * send-order-request — Supabase Edge Function (Deno).
 *
 * Emails a checkout order request to the store through Resend. Called from
 * src/services/orders.ts with supabase.functions.invoke().
 *
 * Secrets (set with `supabase secrets set NAME=value`, never in the frontend):
 *   RESEND_API_KEY    Resend API key
 *   ORDER_EMAIL_TO    store inbox that receives order requests
 *   ORDER_EMAIL_FROM  verified Resend sender, e.g. "Perfumeria <orders@yourdomain.com>"
 *   ALLOWED_ORIGIN    optional; the site origin allowed by CORS (default "*")
 *
 * The recipient comes only from ORDER_EMAIL_TO, never from the request, so
 * the function cannot be used to send mail to arbitrary addresses. Prices
 * are as the customer saw them; the store confirms the final total by hand.
 *
 * Deploy: supabase functions deploy send-order-request
 */

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*"

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

interface OrderLine {
  name: string
  size: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
}

interface OrderCustomer {
  fullName: string
  phone: string
  email: string
}

interface OrderDelivery {
  address: string
  cityArea: string
}

interface OrderGift {
  message: string
}

interface OrderPromo {
  code: string
}

/** The order message already written in the checkout language by the site. */
interface OrderMessage {
  subject: string
  text: string
}

/* Named interfaces only: oxfmt 0.2.0 mangles single-line object types. */
interface OrderRequest {
  reference: string
  createdAt: string
  customer: OrderCustomer
  delivery: OrderDelivery
  notes: string | null
  lines: OrderLine[]
  currency: string
  subtotal: number
  displayedTotal: number
  gift: OrderGift | null
  promo: OrderPromo | null
  locale: "en" | "ar"
  message: OrderMessage | null
}

class InvalidRequest extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function text(value: unknown, max: number, required = true): string {
  if (value == null || value === "") {
    if (required) throw new InvalidRequest("missing field")
    return ""
  }
  if (typeof value !== "string") throw new InvalidRequest("bad field")
  const trimmed = value.trim()
  if ((required && !trimmed) || trimmed.length > max) {
    throw new InvalidRequest("bad field")
  }
  return trimmed
}

function amount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new InvalidRequest("bad amount")
  }
  return value
}

/** Accepts only the fields the email needs, with length and type limits. */
function parseOrder(input: unknown): OrderRequest {
  if (!input || typeof input !== "object") throw new InvalidRequest("body")
  const body = input as Record<string, any>
  if (
    !Array.isArray(body.lines) ||
    !body.lines.length ||
    body.lines.length > 50
  ) {
    throw new InvalidRequest("lines")
  }
  const email = text(body.customer?.email, 160)
  if (!EMAIL.test(email)) throw new InvalidRequest("email")
  const currency = text(body.currency, 3)
  if (!/^[A-Z]{3}$/.test(currency)) throw new InvalidRequest("currency")

  return {
    reference: text(body.reference, 40),
    createdAt: text(body.createdAt, 40),
    customer: {
      fullName: text(body.customer?.fullName, 120),
      phone: text(body.customer?.phone, 40),
      email,
    },
    delivery: {
      address: text(body.delivery?.address, 300),
      cityArea: text(body.delivery?.cityArea, 120),
    },
    notes: text(body.notes, 1000, false) || null,
    lines: body.lines.map((line: Record<string, unknown>) => {
      const quantity = amount(line.quantity)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        throw new InvalidRequest("quantity")
      }
      return {
        name: text(line.name, 120),
        size: text(line.size, 20, false) || null,
        quantity,
        unitPrice: amount(line.unitPrice),
        lineTotal: amount(line.lineTotal),
      }
    }),
    currency,
    subtotal: amount(body.subtotal),
    displayedTotal: amount(body.displayedTotal),
    gift: body.gift ? { message: text(body.gift.message, 250, false) } : null,
    promo: body.promo ? { code: text(body.promo.code, 40) } : null,
    locale: body.locale === "ar" ? "ar" : "en",
    message: body.message
      ? {
          subject: text(body.message.subject, 200),
          text: text(body.message.text, 10000),
        }
      : null,
  }
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

/**
 * The site's localized message (English or Arabic), sent as plain text and
 * as escaped HTML in the matching direction.
 */
function renderLocalizedEmail(order: OrderRequest, message: OrderMessage) {
  const dir = order.locale === "ar" ? "rtl" : "ltr"
  const html = `<!doctype html><html lang="${order.locale}" dir="${dir}"><body style="font-family:Arial,sans-serif;color:#181816;font-size:14px;line-height:1.6">
<div dir="${dir}" style="white-space:pre-wrap">${escapeHtml(message.text)}</div>
</body></html>`
  return { text: message.text, html }
}

function renderEmail(order: OrderRequest) {
  if (order.message) return renderLocalizedEmail(order, order.message)
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: order.currency,
  })
  const price = (value: number) => money.format(value)
  const { customer, delivery } = order

  const rows: [string, string][] = [
    ["Name", customer.fullName],
    ["Phone", customer.phone],
    ["Email", customer.email],
    ["Address", delivery.address],
    ["City / Area", delivery.cityArea],
    ["Notes", order.notes ?? "—"],
    ["Gift", order.gift ? order.gift.message || "Yes (no message)" : "No"],
    [
      "Promo code",
      order.promo
        ? `${order.promo.code} (entered — not automatically applied)`
        : "—",
    ],
  ]

  const lineText = order.lines.map(
    (line, index) =>
      `${index + 1}. ${line.name}${
        line.size ? ` (${line.size})` : ""
      } — ${line.quantity} × ${price(line.unitPrice)} = ${price(line.lineTotal)}`,
  )

  const textBody = [
    `New order request ${order.reference}`,
    `Received ${order.createdAt}`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Order",
    ...lineText,
    "",
    `Subtotal: ${price(order.subtotal)}`,
    "Shipping: Confirmed by the store",
    "Tax: Confirmed by the store",
    `Displayed total: ${price(order.displayedTotal)}`,
    "",
    "No payment was taken. Contact the customer to confirm the order.",
  ].join("\n")

  const cell = "padding:6px 12px 6px 0;vertical-align:top;"
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#181816;font-size:14px;line-height:1.5">
<h2 style="font-weight:400">New order request ${escapeHtml(order.reference)}</h2>
<table style="border-collapse:collapse">${rows
    .map(
      ([label, value]) =>
        `<tr><td style="${cell}color:#716d67">${escapeHtml(label)}</td><td style="${cell}white-space:pre-line">${escapeHtml(value)}</td></tr>`,
    )
    .join("")}</table>
<h3 style="font-weight:400;margin-top:24px">Order</h3>
<table style="border-collapse:collapse">${order.lines
    .map(
      (line) =>
        `<tr><td style="${cell}">${escapeHtml(line.name)}${
          line.size ? ` (${escapeHtml(line.size)})` : ""
        }</td><td style="${cell}">${line.quantity} × ${escapeHtml(price(line.unitPrice))}</td><td style="${cell}text-align:right">${escapeHtml(price(line.lineTotal))}</td></tr>`,
    )
    .join("")}</table>
<p>Subtotal: ${escapeHtml(price(order.subtotal))}<br>Shipping: Confirmed by the store<br>Tax: Confirmed by the store<br><strong>Displayed total: ${escapeHtml(price(order.displayedTotal))}</strong></p>
<p style="color:#716d67">No payment was taken. Contact the customer to confirm the order.</p>
</body></html>`

  return { text: textBody, html }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (request.method !== "POST") {
    return json(405, { code: "method_not_allowed" })
  }

  const apiKey = Deno.env.get("RESEND_API_KEY")
  const to = Deno.env.get("ORDER_EMAIL_TO")
  const from = Deno.env.get("ORDER_EMAIL_FROM")
  if (!apiKey || !to || !from) {
    return json(503, { code: "not_configured" })
  }

  let order: OrderRequest
  try {
    order = parseOrder(await request.json())
  } catch {
    return json(400, { code: "invalid_request" })
  }

  const { text: textBody, html } = renderEmail(order)
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: order.customer.email,
      // Line breaks in a name must not reach the subject header.
      subject: `${
        order.message?.subject ?? `Order request ${order.reference}`
      } — ${order.customer.fullName}`.replace(/[\r\n]+/g, " "),
      text: textBody,
      html,
    }),
  })

  if (!response.ok) {
    console.error("Resend error", response.status, await response.text())
    return json(502, { code: "send_failed" })
  }
  return json(200, { status: "sent", reference: order.reference })
})
