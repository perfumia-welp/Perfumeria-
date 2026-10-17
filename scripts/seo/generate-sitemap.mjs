/*
 * Writes public/sitemap.xml (and the Sitemap line of public/robots.txt) from
 * the live company catalogue, so the sitemap always lists the products the
 * site can actually show. Runs before every `npm run build` (prebuild) and by
 * hand with `npm run seo:sitemap`.
 *
 * What is listed: the indexable pages only (home, all products, the men and
 * women collections, About, Contact, FAQ, every live product), never the bag,
 * checkout, account, sign-in, search or filtered/sorted URLs. Arabic URLs are
 * listed only where the Arabic page is a real translation: the shop pages, and
 * products that have our own Arabic name (and description) in Supabase
 * product_metadata, the same rule the site uses (src/lib/seo.ts).
 *
 * The site address comes from VITE_SITE_URL or src/config/site.ts. If the
 * catalogue cannot be read, the existing sitemap is kept: with --keep-on-error
 * (used by prebuild) the build goes on, otherwise the script fails.
 *
 * Node 22.12+: node --experimental-strip-types scripts/seo/generate-sitemap.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { SEO } from "../../src/config/site.ts"
import { LIVE_CATALOG } from "../../src/config/catalog.ts"
import { paths, productPath } from "../../src/router/paths.ts"
import { normalizeProduct } from "../../src/services/products/adapter.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const keepOnError = process.argv.includes("--keep-on-error")

/** VITE_* values from the environment, else .env.local / .env (never printed). */
function env(name) {
  if (process.env[name]) return process.env[name]
  for (const file of [".env.local", ".env"]) {
    try {
      const line = fs
        .readFileSync(path.join(root, file), "utf8")
        .split(/\r?\n/)
        .find((row) => row.startsWith(`${name}=`))
      if (line) return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "")
    } catch {
      // No such file.
    }
  }
  return undefined
}

const siteUrl = (env("VITE_SITE_URL") || SEO.siteUrl).replace(/\/+$/, "")
const url = (appPath) => `${siteUrl}${appPath === "/" ? "/" : appPath}`
const arabic = (appPath) => (appPath === "/" ? "/ar" : `/ar${appPath}`)

async function getJson(href, headers) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LIVE_CATALOG.timeoutMs)
  try {
    const response = await fetch(href, { headers, signal: controller.signal })
    if (!response.ok) throw new Error(`${response.status} for ${new URL(href).pathname}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

async function liveProducts() {
  const body = await getJson(
    `${LIVE_CATALOG.apiBase}/businesses/${LIVE_CATALOG.businessId}/all-products`,
    { "App-ID": LIVE_CATALOG.appId, "Accept-Language": "EN", Accept: "application/json" },
  )
  if (!Array.isArray(body?.data)) throw new Error("Invalid catalogue")
  const config = {
    businessId: LIVE_CATALOG.businessId,
    currency: LIVE_CATALOG.currency,
    mediaOrigin: LIVE_CATALOG.mediaOrigin,
    productTypeGender: LIVE_CATALOG.productTypeGender,
  }
  const products = []
  let skipped = 0
  for (const row of body.data.flatMap((group) => group?.products ?? [])) {
    try {
      products.push(normalizeProduct(row, config, "en"))
    } catch {
      skipped++ // The site cannot show it either (product page is a 404).
    }
  }
  return { products, skipped }
}

/** Product ids whose Arabic page has our own Arabic name (and description). */
async function arabicReadyIds(products) {
  const base = env("VITE_SUPABASE_URL")
  const key = env("VITE_SUPABASE_PUBLISHABLE_KEY")
  if (!base || !key) {
    console.warn("sitemap: Supabase is not configured; no Arabic product URLs listed.")
    return new Set()
  }
  try {
    const rows = await getJson(
      `${base.replace(/\/+$/, "")}/rest/v1/product_metadata?select=product_id,name_ar,editorial_description_ar&business_id=eq.${LIVE_CATALOG.businessId}`,
      { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    )
    const byId = new Map(rows.map((row) => [row.product_id, row]))
    return new Set(
      products
        .filter((product) => {
          const row = byId.get(product.productId)
          return (
            row?.name_ar?.trim() &&
            (!product.translations.description.en || row.editorial_description_ar?.trim())
          )
        })
        .map((product) => product.productId),
    )
  } catch (error) {
    console.warn(`sitemap: Arabic metadata unavailable (${error.message}); no Arabic product URLs listed.`)
    return new Set()
  }
}

const escape = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** One <url>; with `translated`, both language versions declare each other. */
function entry(loc, alternates) {
  const links = alternates
    ? [
        ["en", alternates.en],
        ["ar", alternates.ar],
        ["x-default", alternates.en],
      ]
        .map(
          ([lang, href]) =>
            `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${escape(href)}"/>`,
        )
        .join("")
    : ""
  return `  <url>\n    <loc>${escape(loc)}</loc>${links}\n  </url>`
}

async function main() {
  const { products, skipped } = await liveProducts()
  if (!products.length) throw new Error("The catalogue is empty")
  const ready = await arabicReadyIds(products)
  const genders = new Set(products.map((product) => product.gender))
  const collections = [
    ["men", paths.menPerfumes],
    ["women", paths.womenPerfumes],
  ]
    .filter(([gender]) => genders.has(gender))
    .map(([, appPath]) => appPath)

  // [path, has an equivalent Arabic page]
  const pages = [
    [paths.home, true],
    [paths.products, true],
    ...collections.map((appPath) => [appPath, true]),
    [paths.about, false], // Arabic About is not an approved translation yet.
    [paths.contact, true],
    [paths.faq, false], // Owner FAQ is English only.
    ...products
      .sort((a, b) => b.productId - a.productId)
      .map((product) => [productPath(product.slug), ready.has(product.productId)]),
  ]

  const entries = pages.flatMap(([appPath, translated]) => {
    if (!translated) return [entry(url(appPath))]
    const alternates = { en: url(appPath), ar: url(arabic(appPath)) }
    return [entry(alternates.en, alternates), entry(alternates.ar, alternates)]
  })
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/seo/generate-sitemap.mjs. Do not edit by hand. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`
  fs.writeFileSync(path.join(root, "public/sitemap.xml"), xml)

  const robotsFile = path.join(root, "public/robots.txt")
  const robots = fs.readFileSync(robotsFile, "utf8")
  fs.writeFileSync(
    robotsFile,
    robots.replace(/^Sitemap: .*$/m, `Sitemap: ${siteUrl}/sitemap.xml`),
  )

  console.log(
    `sitemap: ${entries.length} URLs (${products.length} products, ${ready.size} with Arabic pages${skipped ? `, ${skipped} malformed skipped` : ""}) for ${siteUrl}`,
  )
}

main().catch((error) => {
  console.error(`sitemap: not updated (${error.message}).`)
  if (!keepOnError) process.exit(1)
  console.error("sitemap: keeping the existing public/sitemap.xml.")
})
