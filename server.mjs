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
 * The newsletter list (Supabase) uses the site's public Supabase settings,
 * the same values the build already ships to the browser; no secret key:
 *
 *   SUPABASE_URL              or VITE_SUPABASE_URL
 *   SUPABASE_PUBLISHABLE_KEY  or VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Without them the newsletter form reports that sign-up is unavailable.
 */
import nodemailer from "nodemailer"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createApp } from "./server/app.mjs"
import { supabaseNewsletter } from "./server/newsletter.mjs"

const root = path.dirname(fileURLToPath(import.meta.url))
const env = process.env

const port = Number(env.SMTP_PORT || 465)
const secure = env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465
const mailTo = env.MAIL_TO?.trim()
const mailFrom = env.MAIL_FROM?.trim() || env.SMTP_USER?.trim()
const configured = Boolean(
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && mailTo && mailFrom,
)

const transport = configured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure,
      // Port 587 starts plain and must upgrade to TLS before logging in.
      requireTLS: !secure,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    })
  : null

const trustProxy = (() => {
  const value = env.TRUST_PROXY?.trim()
  if (!value) return 1
  if (value === "true" || value === "false") return value === "true"
  return /^\d+$/.test(value) ? Number(value) : value
})()

const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL)?.trim()
const supabaseKey = (
  env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
)?.trim()
const newsletter =
  supabaseUrl && supabaseKey
    ? supabaseNewsletter({ url: supabaseUrl, publishableKey: supabaseKey })
    : null

const app = createApp({
  distDir: path.join(root, "dist"),
  transport,
  mail: { from: mailFrom, to: mailTo },
  newsletter,
  trustProxy,
})

const listenPort = Number(env.PORT || 3000)
app.listen(listenPort, () => {
  // Never print the password or the full configuration.
  console.log(
    `Perfumira server on port ${listenPort}; contact email ${
      configured ? `via ${env.SMTP_HOST}:${port}` : "not configured"
    }; newsletter ${newsletter ? "on" : "not configured"}`,
  )
})
