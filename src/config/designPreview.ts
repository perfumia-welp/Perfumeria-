/*
 * Design comparison controls (the Hero and product-card A/B/C switches).
 *
 * Shown on the Vite dev server, on the temporary Cloudflare client-review
 * preview (any *.workers.dev address) and on builds made with
 * VITE_ENABLE_DESIGN_PREVIEW=true. The address check exists because the
 * Cloudflare build did not receive that variable, so its bundle had the
 * switches compiled out. The perfumira.net production build leaves the
 * variable unset and is never served from workers.dev, so this is false
 * there: the switches never render and their lazy chunks are never
 * requested. Signing in or out has no effect on this.
 */
const REVIEW_PREVIEW_HOST = /\.workers\.dev$/i

export const designPreview =
  import.meta.env.DEV ||
  import.meta.env.VITE_ENABLE_DESIGN_PREVIEW === "true" ||
  REVIEW_PREVIEW_HOST.test(window.location.hostname)
