import express from "express"
import { rateLimit } from "express-rate-limit"
import fs from "node:fs"
import path from "node:path"
import { buildContactEmail, validateContact } from "./contact.mjs"
import { NewsletterError, validateNewsletter } from "./newsletter.mjs"
import { securityHeaders } from "./securityHeaders.mjs"
import { createOrderHandler } from "./orders.mjs"

/*
 * The production web app (Hostinger Node.js): the Vite build in dist/, the
 * form API under /api, and index.html for every app route so React Router
 * can render direct visits and refreshes.
 *
 * Built by createApp() so tests can pass a fake mail transport.
 */

/** Files with these extensions are real files: a missing one is a 404, never the app. */
const FILE_EXTENSION =
  /\.(?:js|mjs|css|map|json|xml|txt|ico|png|jpe?g|webp|avif|gif|svg|woff2?|ttf|otf|mp4|webm|mov|pdf|webmanifest)$/i

/** Host configuration files copied into dist/ from public/; not for visitors. */
const PRIVATE_FILES = new Set(["/_headers", "/_redirects", "/.htaccess"])

const SEND_TIMEOUT_MS = 20000

/**
 * @param {object} options
 * @param {string} options.distDir      Vite build output.
 * @param {{ sendMail(message: object): Promise<unknown> } | null} options.transport
 *        SMTP transport, or null when mail is not configured.
 * @param {{ from: string, to: string }} options.mail  Contact emails (and orders without orderMail).
 * @param {{ from: string, to: string }} [options.orderMail]  Order notification emails; defaults to mail.
 * @param {object | null} [options.orderStore]  Verified order storage
 *        (server/orders.mjs supabaseOrderStore), or null when not configured.
 * @param {(productId: number) => Promise<object>} [options.getProduct]
 *        Catalogue lookup for orders; defaults to the company API.
 * @param {{ windowMs: number, limit: number }} [options.orderLimit]
 * @param {{ windowMs: number, limit: number }} [options.contactLimit]
 * @param {((value: { email: string, locale: string }) => Promise<string>) | null} [options.newsletter]
 *        Adds an address to the subscriber list (server/newsletter.mjs), or
 *        null when the list is not configured.
 * @param {{ windowMs: number, limit: number }} [options.newsletterLimit]
 * @param {boolean | number | string} [options.trustProxy] Express "trust proxy".
 * @param {string | null} [options.supabaseUrl] Allowed in the CSP connect-src.
 * @param {string} [options.cspMode] "enforce" (default), "report-only" or "off".
 * @param {(message: string, detail?: object) => void} [options.log]
 */
export function createApp({
  distDir,
  transport,
  mail,
  orderMail = mail,
  orderStore = null,
  getProduct,
  orderLimit = { windowMs: 15 * 60 * 1000, limit: 20 },
  contactLimit = { windowMs: 15 * 60 * 1000, limit: 8 },
  newsletter = null,
  newsletterLimit = { windowMs: 15 * 60 * 1000, limit: 6 },
  trustProxy = 1,
  supabaseUrl = null,
  cspMode = "enforce",
  log = (message, detail) => console.error(message, detail ?? ""),
}) {
  const app = express()
  app.disable("x-powered-by")
  // Hostinger puts a proxy in front of the app; the visitor's address (for
  // the rate limit) is in X-Forwarded-For, set by that one hop.
  app.set("trust proxy", trustProxy)

  const indexFile = path.join(distDir, "index.html")

  // CSP, HSTS, framing, nosniff, referrer and permissions
  // (server/securityHeaders.mjs), on every response from this app.
  app.use(securityHeaders({ indexFile, supabaseUrl, mode: cspMode }))

  // ------------------------------------------------------------------ API
  const api = express.Router()
  const fail = (res, status, error, extra = {}) =>
    res.status(status).json({ ok: false, error, ...extra })

  api.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store")
    next()
  })

  api.get("/health", (req, res) => res.json({ ok: true }))
  // Orders: per visitor address, in memory, like the contact limit.
  const orderLimiter = rateLimit({
    windowMs: orderLimit.windowMs,
    limit: orderLimit.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => {
      log("Order submission failed", { category: "rate_limited" })
      fail(res, 429, "rate_limited")
    },
  })

  api.post(
    "/orders",
    orderLimiter,
    express.json({ limit: "64kb", strict: true }),
    createOrderHandler({ store: orderStore, transport, mail: orderMail, getProduct, log }),
  )

  // Counted per visitor address in memory only: nothing is written to disk
  // and the counts disappear when the window passes or the app restarts.
  const contactLimiter = rateLimit({
    windowMs: contactLimit.windowMs,
    limit: contactLimit.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => fail(res, 429, "rate_limited"),
  })

  api.post(
    "/contact",
    contactLimiter,
    express.json({ limit: "32kb", strict: true, type: "application/json" }),
    async (req, res) => {
      if (!req.is("application/json"))
        return fail(res, 415, "unsupported_media_type")

      const result = validateContact(req.body)
      if (!result.ok)
        return result.error === "validation"
          ? fail(res, 400, "validation", { fields: result.fields })
          : fail(res, 400, "invalid_request")

      if (!transport) return fail(res, 503, "unavailable")

      try {
        const message = buildContactEmail(result.value, mail)
        await withTimeout(transport.sendMail(message), SEND_TIMEOUT_MS)
        return res.json({ ok: true })
      } catch (error) {
        // Server log only: never the message text, never the SMTP details
        // in the response.
        log("Contact email could not be sent", {
          code: error?.code,
          responseCode: error?.responseCode,
          command: error?.command,
        })
        return fail(res, 502, "send_failed")
      }
    },
  )

  api.all("/contact", (req, res) => {
    res.setHeader("Allow", "POST")
    fail(res, 405, "method_not_allowed")
  })

  // Newsletter: the address goes to the private subscriber list. The answer
  // is the same whether the address is new or already on the list, so the
  // form cannot be used to find out who is subscribed. Same counting as the
  // contact limit.
  const newsletterLimiter = rateLimit({
    windowMs: newsletterLimit.windowMs,
    limit: newsletterLimit.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => fail(res, 429, "rate_limited"),
  })

  api.post(
    "/newsletter",
    newsletterLimiter,
    express.json({ limit: "4kb", strict: true, type: "application/json" }),
    async (req, res) => {
      if (!req.is("application/json"))
        return fail(res, 415, "unsupported_media_type")

      const result = validateNewsletter(req.body)
      if (!result.ok)
        return result.error === "validation"
          ? fail(res, 400, "validation", { fields: result.fields })
          : fail(res, 400, "invalid_request")

      if (!newsletter) return fail(res, 503, "unavailable")

      try {
        await newsletter(result.value)
        return res.json({ ok: true })
      } catch (error) {
        if (error instanceof NewsletterError && error.code === "invalid_email")
          return fail(res, 400, "validation", { fields: ["email"] })
        // Server log only: never the address, never the database's answer.
        log("Newsletter sign-up failed", {
          code: error?.code,
          ...(error instanceof NewsletterError ? error.detail : {}),
        })
        return fail(res, 502, "subscribe_failed")
      }
    },
  )

  api.all("/newsletter", (req, res) => {
    res.setHeader("Allow", "POST")
    fail(res, 405, "method_not_allowed")
  })

  api.use((req, res) => fail(res, 404, "not_found"))

  // Malformed JSON, oversized bodies and anything unexpected in the API.
  api.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    if (error?.type === "entity.too.large")
      return fail(res, 413, "payload_too_large")
    if (error?.type === "entity.parse.failed" || error?.status === 400)
      return fail(res, 400, "invalid_request")
    log("API error", { name: error?.name, type: error?.type })
    return fail(res, 500, "server_error")
  })

  app.use("/api", api)

  // ------------------------------------------------------- Static + app

  app.use((req, res, next) => {
    if (PRIVATE_FILES.has(req.path)) return res.status(404).end()
    next()
  })

  app.use(
    express.static(distDir, {
      index: false,
      redirect: false,
      dotfiles: "ignore",
      setHeaders(res, filePath) {
        const relative = path.relative(distDir, filePath).replace(/\\/g, "/")
        // Same rules as public/.htaccess and deploy/cloudflare/_headers.
        if (relative.startsWith("assets/"))
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
        else if (/^(images|videos)\//.test(relative))
          res.setHeader(
            "Cache-Control",
            "public, max-age=3600, stale-while-revalidate=86400",
          )
      },
    }),
  )

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next()
    // A missing build file (e.g. an old hashed chunk after a redeploy) stays a
    // real 404, never the HTML page served as JavaScript or CSS.
    if (req.path.startsWith("/assets/") || FILE_EXTENSION.test(req.path))
      return res.status(404).type("text/plain").send("Not found")
    if (!fs.existsSync(indexFile))
      return res.status(503).type("text/plain").send("Site is being updated.")
    res.setHeader("Cache-Control", "no-cache")
    res.sendFile(indexFile)
  })

  app.use((req, res) => res.status(404).type("text/plain").send("Not found"))

  return app
}

function withTimeout(promise, ms) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () =>
          reject(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })),
        ms,
      )
    }),
  ]).finally(() => clearTimeout(timer))
}
