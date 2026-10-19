/*
 * Design comparison controls (the Hero and product-card A/B/C switches).
 *
 * Shown on the Vite dev server and on builds made with
 * VITE_ENABLE_DESIGN_PREVIEW=true: set that build variable ONLY for the
 * temporary Cloudflare client-review preview. The perfumira.net production
 * build leaves it unset, so this is false there (fixed at build time): the
 * switches never render and nothing loads their code. Rollup still writes
 * their lazy chunk files to dist/assets, unreferenced, because the flag lives
 * in this module rather than inline at each import.
 */
export const designPreview =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DESIGN_PREVIEW === "true"
