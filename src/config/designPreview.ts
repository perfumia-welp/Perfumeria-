/*
 * Design comparison controls (the Hero and product-card A/B/C switches).
 *
 * Shown on the Vite dev server and on builds made with
 * VITE_ENABLE_DESIGN_PREVIEW=true: set that build variable ONLY for the
 * temporary Cloudflare client-review preview. The perfumira.net production
 * build leaves it unset, so this is false there and Vite removes the
 * comparison code from the bundle entirely (the value is fixed at build time).
 */
export const designPreview =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DESIGN_PREVIEW === "true"
