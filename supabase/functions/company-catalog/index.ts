import { createCatalogHandler, type ServerConfig } from "./handler.ts"

const baseUrl = Deno.env.get("COMPANY_API_BASE_URL")
const businessId = Deno.env.get("COMPANY_BUSINESS_ID")
const token = Deno.env.get("COMPANY_API_TOKEN")
const currency = Deno.env.get("COMPANY_CURRENCY")
const allowedOrigin = Deno.env.get("CATALOG_ALLOWED_ORIGIN")
// COMPANY_API_TOKEN is optional: the public WEBSITE API needs none today.
const config: ServerConfig | null = baseUrl && businessId && currency && allowedOrigin
  ? { baseUrl, businessId: Number(businessId), token: token || undefined, currency, allowedOrigin, mediaOrigin: Deno.env.get("COMPANY_MEDIA_ORIGIN") }
  : null

// Dormant: no reader is installed, so this answers 503 even if deployed. If a
// proxy is ever needed, install a CompanyReader for the verified public API
// (GET https://api.welpstar.com/api/v1/businesses/{id}/all-products and
// /products/{id}, header App-ID: WEBSITE) with fixed routes, redirect: "error"
// and a timeout. Never accept frontend endpoint/method input.
Deno.serve(createCatalogHandler(config))
