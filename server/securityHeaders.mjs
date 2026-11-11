/*
 * Security headers for every response the Node app sends (HTML, /assets,
 * /api). Hostinger's static layer answers a few top-level files itself
 * (robots.txt, sitemap.xml, favicon.svg, social-preview.png) before the app
 * runs; those are not documents, so they need no Content-Security-Policy.
 *
 * Content-Security-Policy is built from what the site really loads:
 *
 *   script-src   our own files, plus the inline scripts in index.html
 *                (hero preload, Arabic direction, font preloads), allowed
 *                by their SHA-256 hash only
 *   style-src    our own files, plus the inline startup-screen <style>, by
 *                hash; React's style={…} props set CSSOM properties, which
 *                CSP does not restrict
 *   img-src      our own images; images.unsplash.com (editorial photos);
 *                welp.fsn1.your-objectstorage.com (company product photos,
 *                the fallback when the resizer fails); wsrv.nl (resized
 *                product photos, src/config/catalog.ts)
 *   connect-src  our own /api; Supabase (auth, bag, account, newsletter
 *                reads); api.welpstar.com (the public catalogue)
 *   font-src, media-src   our own files only (self-hosted fonts and videos)
 *
 * The hashes are read from the dist/index.html this server actually sends,
 * so they always match the deployed build and need no manual update when
 * index.html changes.
 *
 * CSP_MODE (server env): "enforce" (default), "report-only" (the browser
 * only reports, nothing is blocked: an emergency switch that needs no new
 * build) or "off".
 */
import crypto from "node:crypto"
import fs from "node:fs"

/** Image hosts the storefront shows. Keep in step with src/config/catalog.ts and src/data/mockImages.ts. */
export const IMAGE_ORIGINS = [
  "https://images.unsplash.com",
  "https://welp.fsn1.your-objectstorage.com",
  "https://wsrv.nl",
]

/** The public company catalogue API (src/config/catalog.ts). */
export const CATALOG_ORIGIN = "https://api.welpstar.com"

export const CSP_MODES = ["enforce", "report-only", "off"]

/**
 * SHA-256 sources for every inline <script> (without src) and <style> in an
 * HTML document, exactly as the browser hashes them: the HTML parser turns
 * every CR LF and lone CR into LF before it hashes, so a build made on
 * Windows (CRLF) gets the same hashes as one made on Linux.
 */
export function inlineHashes(html) {
  const scripts = new Set()
  const styles = new Set()
  for (const match of html.replace(/\r\n?/g, "\n").matchAll(
    /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi,
  )) {
    const [, tag, attributes, body] = match
    if (tag.toLowerCase() === "script" && /\bsrc\s*=/i.test(attributes))
      continue
    const hash = `'sha256-${crypto.createHash("sha256").update(body, "utf8").digest("base64")}'`
    ;(tag.toLowerCase() === "script" ? scripts : styles).add(hash)
  }
  return { scripts: [...scripts], styles: [...styles] }
}

/** The https origin of a Supabase project URL, or null when it is not one. */
export function supabaseOrigin(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" ? parsed.origin : null
  } catch {
    return null
  }
}

/** The Content-Security-Policy value. */
export function buildCsp({ scripts = [], styles = [], supabase = null } = {}) {
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", ...scripts],
    "style-src": ["'self'", ...styles],
    "img-src": ["'self'", ...IMAGE_ORIGINS],
    "font-src": ["'self'"],
    "media-src": ["'self'"],
    "connect-src": ["'self'", ...(supabase ? [supabase] : []), CATALOG_ORIGIN],
    "manifest-src": ["'self'"],
    "worker-src": ["'none'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  }
  return [
    ...Object.entries(directives).map(
      ([name, sources]) => `${name} ${sources.join(" ")}`,
    ),
    "upgrade-insecure-requests",
  ].join("; ")
}

/** The headers that do not depend on the build. */
export const STATIC_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // One year, this host only: no includeSubDomains (mail and other
  // subdomains are not ours to promise HTTPS for) and no preload.
  "Strict-Transport-Security": "max-age=31536000",
  // Older browsers without CSP frame-ancestors.
  "X-Frame-Options": "DENY",
  "Permissions-Policy": [
    "accelerometer=()",
    "browsing-topics=()",
    "camera=()",
    "display-capture=()",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "microphone=()",
    "midi=()",
    "payment=()",
    "usb=()",
  ].join(", "),
  "Cross-Origin-Opener-Policy": "same-origin",
}

/**
 * Express middleware that sets the security headers. The policy is rebuilt
 * whenever dist/index.html changes (a redeploy), checked at most once a second.
 *
 * @param {object} options
 * @param {string} options.indexFile  dist/index.html
 * @param {string | null} options.supabaseUrl
 * @param {string} [options.mode]     One of CSP_MODES.
 */
export function securityHeaders({ indexFile, supabaseUrl, mode = "enforce" }) {
  if (!CSP_MODES.includes(mode)) mode = "enforce"
  const supabase = supabaseOrigin(supabaseUrl)
  const header =
    mode === "report-only"
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy"

  let policy = buildCsp({ supabase })
  let stamp = null
  let checkedAt = 0
  const refresh = () => {
    const now = Date.now()
    if (now - checkedAt < 1000) return
    checkedAt = now
    let stat
    try {
      stat = fs.statSync(indexFile)
    } catch {
      stamp = null
      policy = buildCsp({ supabase })
      return
    }
    const next = `${stat.mtimeMs}:${stat.size}`
    if (next === stamp) return
    try {
      const hashes = inlineHashes(fs.readFileSync(indexFile, "utf8"))
      policy = buildCsp({ ...hashes, supabase })
      stamp = next
    } catch {
      // Keep the previous policy; try again on a later request.
    }
  }

  const middleware = (req, res, next) => {
    for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS))
      res.setHeader(name, value)
    if (mode !== "off") {
      refresh()
      res.setHeader(header, policy)
    }
    next()
  }
  middleware.policy = () => (refresh(), policy)
  middleware.mode = mode
  middleware.supabase = supabase
  return middleware
}
