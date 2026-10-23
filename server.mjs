/*
 * Perfumira production server (Hostinger Node.js Web App).
 *
 *   npm run build   Vite builds the site into dist/
 *   npm start       node server.mjs: serves dist/ and the /api form endpoints
 *
 * Mail goes through Titan SMTP. Settings come from server-only environment
 * variables (Hostinger → the web app's environment variables), never from a
 * VITE_ variable, which would be shipped to the browser:
 *
 *   SMTP_HOST    smtp.titan.email
 *   SMTP_PORT    465
 *   SMTP_SECURE  true (SSL/TLS on 465)
 *   SMTP_USER    the full mailbox address
 *   SMTP_PASS    the mailbox password (secret)
 *   MAIL_FROM    Perfumira Website <info@perfumira.net>
 *   MAIL_TO      info@perfumira.net
 *   PORT         set by the host (default 3000)
 *   TRUST_PROXY  proxy hops in front of the app (default 1)
 *
 * Without SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_TO the site still runs and
 * the contact form reports that sending is unavailable.
 *
 * The newsletter list (Supabase):
 *
 *   SUPABASE_URL               or VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  secret, server only, never a VITE_ variable.
 *                              Used when set, so the sign-up function can be
 *                              closed to website visitors
 *                              (supabase/pending/newsletter-server-only).
 *   SUPABASE_PUBLISHABLE_KEY   or VITE_SUPABASE_PUBLISHABLE_KEY: used only
 *                              while the service role key is not set.
 *
 * Without a URL and a key the newsletter form reports that sign-up is
 * unavailable.
 *
 * Security headers (server/securityHeaders.mjs):
 *
 *   CSP_MODE  enforce (default) | report-only | off. report-only is the
 *             emergency switch if the Content-Security-Policy ever blocks
 *             something: change it and restart, no new build needed.
 *
 * The Supabase URL above is also the one origin added to the policy's
 * connect-src, so it must be the same project the build ships to browsers.
 *
 * Orders (/api/orders) are stored through the service role, which bypasses
 * row level security; the key must never be a VITE_ variable:
 *
 *   SUPABASE_URL               or VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  the service role key (secret, server only)
 *
 * Without the key checkout reports that ordering is unavailable. Order
 * emails use the same SMTP and MAIL_FROM settings as contact.
 */
import nodemailer from "nodemailer"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createApp } from "./server/app.mjs"
import { supabaseNewsletter } from "./server/newsletter.mjs"
import { CSP_MODES } from "./server/securityHeaders.mjs"
import { smtpPort, smtpTransportOptions } from "./server/smtp.mjs"
import { createClient } from "@supabase/supabase-js"
import { supabaseOrderStore } from "./server/orders.mjs"

const root = path.dirname(fileURLToPath(import.meta.url))
const env = process.env

const { port } = smtpPort(env)
const mailTo = env.MAIL_TO?.trim()
const mailFrom = env.MAIL_FROM?.trim() || env.SMTP_USER?.trim()
const configured = Boolean(
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && mailTo && mailFrom,
)

const transport = configured
  ? nodemailer.createTransport(smtpTransportOptions(env))
  : null

const trustProxy = (() => {
  const value = env.TRUST_PROXY?.trim()
  if (!value) return 1
  if (value === "true" || value === "false") return value === "true"
  return /^\d+$/.test(value) ? Number(value) : value
})()

const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL)?.trim()
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const publishableKey = (
  env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
)?.trim()
const newsletterKey = serviceRoleKey || publishableKey
const newsletter =
  supabaseUrl && newsletterKey
    ? supabaseNewsletter({ url: supabaseUrl, key: newsletterKey })
    : null

// Anything unrecognised enforces the policy.
const cspMode = CSP_MODES.includes(env.CSP_MODE?.trim())
  ? env.CSP_MODE.trim()
  : "enforce"

const orderStore =
  supabaseUrl && serviceRoleKey
    ? supabaseOrderStore(
        createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (url, options) =>
              fetch(url, { ...options, signal: AbortSignal.timeout(20000) }),
          },
        }),
      )
    : null

const app = createApp({
  orderStore,
  distDir: path.join(root, "dist"),
  transport,
  mail: { from: mailFrom, to: mailTo },
  newsletter,
  trustProxy,
  supabaseUrl,
  cspMode,
})

const listenPort = Number(env.PORT || 3000)
app.listen(listenPort, () => {
  // Never print a password, a key or the full configuration.
  console.log(
    `Perfumira server on port ${listenPort}; contact email ${
      configured ? `via ${env.SMTP_HOST}:${port}` : "not configured"
    }; newsletter ${
      newsletter
        ? `on (${serviceRoleKey ? "server key" : "public key"})`
        : "not configured"
    }; orders ${orderStore ? "on" : "not configured"}; CSP ${cspMode}${supabaseUrl ? "" : " (no Supabase URL: Supabase requests will be blocked)"}`,
  )
})
