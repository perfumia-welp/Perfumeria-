/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Public site address for canonical/sitemap URLs (default in config/site.ts). */
  readonly VITE_SITE_URL?: string
  /** "true" shows the design A/B/C switches (Cloudflare review preview only; see config/designPreview.ts). */
  readonly VITE_ENABLE_DESIGN_PREVIEW?: string
  /** Test builds only: hosts that send Meta Pixel events (default perfumira.net; see lib/metaPixel.ts). */
  readonly VITE_META_PIXEL_HOSTS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
