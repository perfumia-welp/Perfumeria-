/*
 * Tests for the security headers (server/securityHeaders.mjs) on every
 * response from the app. Run with `npm run test:server`. No network.
 */
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { after, describe, test } from "node:test"
import { createApp } from "./app.mjs"
import {
  buildCsp,
  inlineHashes,
  STATIC_SECURITY_HEADERS,
  supabaseOrigin,
} from "./securityHeaders.mjs"

const MAIL = { from: "Perfumira Website <info@perfumira.net>", to: "info@perfumira.net" }
const SUPABASE = "https://abcdefghijklmnop.supabase.co"
const lf = (text) => text.replace(/\r\n?/g, "\n")
const sha = (text) =>
  `'sha256-${crypto.createHash("sha256").update(text, "utf8").digest("base64")}'`

const BOOT_SCRIPT = "\n  ;(function () { document.documentElement.lang = 'ar' })()\n"
const FONT_SCRIPT = "\r\n  var x = 1\r\n"
const BOOT_STYLE = "\n  #boot { opacity: 0 }\n"
const indexHtml = (script = BOOT_SCRIPT) =>
  `<!doctype html><html><head><script>${script}</script><style>${BOOT_STYLE}</style>` +
  `<script>${FONT_SCRIPT}</script>` +
  `<script type="module" crossorigin src="/assets/index-abc.js"></script></head>` +
  `<body><div id="root"></div></body></html>`

const servers = []
async function start(options = {}) {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), "perfumira-csp-"))
  fs.mkdirSync(path.join(distDir, "assets"))
  fs.writeFileSync(path.join(distDir, "index.html"), indexHtml())
  fs.writeFileSync(path.join(distDir, "assets", "index-abc.js"), "console.log(1)")
  const app = createApp({
    distDir,
    transport: null,
    mail: MAIL,
    supabaseUrl: SUPABASE,
    log: () => {},
    ...options,
  })
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s))
  })
  servers.push(server)
  return { url: `http://127.0.0.1:${server.address().port}`, distDir }
}
after(() => Promise.all(servers.map((s) => new Promise((r) => s.close(r)))))

/** Parses a CSP header into { directive: [sources] }. */
const parse = (value) =>
  Object.fromEntries(
    value.split(";").map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/)
      return [name, sources]
    }),
  )

describe("inlineHashes", () => {
  test("hashes inline scripts and styles as the browser does, skips external scripts", () => {
    const { scripts, styles } = inlineHashes(indexHtml())
    // FONT_SCRIPT has CRLF line ends: the browser hashes it with LF.
    assert.deepEqual(scripts, [sha(BOOT_SCRIPT), sha(lf(FONT_SCRIPT))])
    assert.deepEqual(styles, [sha(BOOT_STYLE)])
  })

  test("CRLF, lone CR and LF builds give the same hashes (HTML newline normalisation)", () => {
    const hash = (html) => inlineHashes(html).scripts[0]
    assert.equal(hash("<script>\r\na\r\n</script>"), hash("<script>\na\n</script>"))
    assert.equal(hash("<script>\ra\r</script>"), hash("<script>\na\n</script>"))
    assert.equal(hash("<script>\na\n</script>"), sha("\na\n"))
  })
})

describe("buildCsp", () => {
  const csp = parse(buildCsp({ scripts: ["'sha256-x'"], supabase: SUPABASE }))

  test("no wildcard, unsafe-inline or unsafe-eval anywhere", () => {
    const all = Object.values(csp).flat()
    for (const bad of ["*", "'unsafe-inline'", "'unsafe-eval'", "https:", "data:", "blob:"])
      assert.ok(!all.includes(bad), bad)
  })

  test("only the site's own origins and the required third parties", () => {
    assert.deepEqual(csp["default-src"], ["'self'"])
    assert.deepEqual(csp["script-src"], ["'self'", "'sha256-x'"])
    assert.deepEqual(csp["connect-src"], ["'self'", SUPABASE, "https://api.welpstar.com"])
    assert.deepEqual(csp["img-src"], [
      "'self'",
      "https://images.unsplash.com",
      "https://welp.fsn1.your-objectstorage.com",
      "https://wsrv.nl",
    ])
    assert.deepEqual(csp["font-src"], ["'self'"])
    assert.deepEqual(csp["frame-ancestors"], ["'none'"])
    assert.deepEqual(csp["object-src"], ["'none'"])
    assert.deepEqual(csp["base-uri"], ["'self'"])
    assert.deepEqual(csp["form-action"], ["'self'"])
    assert.ok("upgrade-insecure-requests" in csp)
  })

  test("supabaseOrigin accepts only an https URL and keeps only its origin", () => {
    assert.equal(supabaseOrigin(`${SUPABASE}/rest/v1/`), SUPABASE)
    assert.equal(supabaseOrigin("http://example.supabase.co"), null)
    assert.equal(supabaseOrigin("not a url"), null)
    assert.equal(supabaseOrigin(undefined), null)
  })
})

describe("security headers on app responses", async () => {
  const site = await start()

  for (const [label, route] of [
    ["home", "/"],
    ["Arabic route", "/ar/products"],
    ["product page", "/products/perfume-14113"],
    ["built asset", "/assets/index-abc.js"],
    ["API", "/api/health"],
    ["missing asset 404", "/assets/missing.js"],
  ]) {
    test(`${label} carries every header`, async () => {
      const response = await fetch(site.url + route)
      for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS))
        assert.equal(response.headers.get(name), value, name)
      const csp = parse(response.headers.get("content-security-policy"))
      assert.deepEqual(csp["script-src"], ["'self'", sha(BOOT_SCRIPT), sha(lf(FONT_SCRIPT))])
      assert.deepEqual(csp["style-src"], ["'self'", sha(BOOT_STYLE)])
      assert.ok(csp["connect-src"].includes(SUPABASE))
      assert.equal(response.headers.get("content-security-policy-report-only"), null)
    })
  }

  test("HSTS is one year, this host only, no preload", async () => {
    const value = (await fetch(site.url)).headers.get("strict-transport-security")
    assert.equal(value, "max-age=31536000")
  })

  test("the policy follows a redeployed index.html", async () => {
    const next = "\n  var redeployed = true\n"
    fs.writeFileSync(path.join(site.distDir, "index.html"), indexHtml(next))
    // The file is checked at most once a second.
    await new Promise((r) => setTimeout(r, 1100))
    const csp = parse((await fetch(site.url)).headers.get("content-security-policy"))
    assert.ok(csp["script-src"].includes(sha(next)))
    assert.ok(!csp["script-src"].includes(sha(BOOT_SCRIPT)))
  })

  test("/_headers is never served by the app", async () => {
    fs.writeFileSync(path.join(site.distDir, "_headers"), "/*\n  X-Robots-Tag: noindex")
    assert.equal((await fetch(`${site.url}/_headers`)).status, 404)
  })
})

describe("CSP_MODE", async () => {
  test("report-only reports without blocking", async () => {
    const site = await start({ cspMode: "report-only" })
    const response = await fetch(site.url)
    assert.equal(response.headers.get("content-security-policy"), null)
    assert.match(response.headers.get("content-security-policy-report-only"), /script-src 'self' 'sha256-/)
    assert.equal(response.headers.get("x-frame-options"), "DENY")
  })

  test("off sends no CSP but keeps the other headers", async () => {
    const site = await start({ cspMode: "off" })
    const response = await fetch(site.url)
    assert.equal(response.headers.get("content-security-policy"), null)
    assert.equal(response.headers.get("content-security-policy-report-only"), null)
    assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000")
  })

  test("an unknown mode enforces", async () => {
    const site = await start({ cspMode: "nonsense" })
    assert.ok((await fetch(site.url)).headers.get("content-security-policy"))
  })

  test("without a Supabase URL the policy simply leaves Supabase out", async () => {
    const site = await start({ supabaseUrl: null })
    const csp = parse((await fetch(site.url)).headers.get("content-security-policy"))
    assert.deepEqual(csp["connect-src"], ["'self'", "https://api.welpstar.com"])
  })
})
