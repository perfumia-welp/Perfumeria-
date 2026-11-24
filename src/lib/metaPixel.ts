/*
 * Meta Pixel for perfumira.net (pixel id supplied by the client, 2026-11-24).
 *
 * One install, from main.tsx. Meta's own base code is reproduced here as a
 * module rather than an inline <script>, so the strict Content-Security-
 * Policy (server/securityHeaders.mjs) only has to allow Meta's hosts:
 * script connect.facebook.net, beacons www.facebook.com.
 *
 *  - The `fbq` queue exists at once, so nothing is lost before Meta's script
 *    arrives; the script itself is requested after the page has loaded and
 *    the browser is idle, so it never competes with the first paint.
 *  - The site is a single-page app: PageView is sent by the router
 *    (MetaPixelPageViews), once per page. Meta's automatic history tracking
 *    is switched off (`disablePushState`) so a route change is never
 *    counted twice, and so filter, sort and View More changes (query string
 *    only) are not page views.
 *  - Automatic configuration (autoConfig: Meta guessing events from button
 *    clicks and page markup) is off: only the events below are sent.
 *  - No customer data (Advanced Matching) is ever passed.
 *  - Every call is wrapped: if an ad blocker stops the script, or Meta
 *    throws, the shop carries on. Calls just stay in the unused queue.
 *
 * Only the live site's own hosts send anything to Meta. Everywhere else
 * (localhost, review servers, previews) the same calls are recorded in
 * `window.__metaPixelEvents` and the console ("not sent"), so the events
 * can be checked without polluting the client's pixel data.
 * VITE_META_PIXEL_HOSTS (comma-separated, build time) replaces the host
 * list, for a test build only.
 */

export const META_PIXEL_ID = "1129636633255881"
const SCRIPT_SRC = "https://connect.facebook.net/en_US/fbevents.js"
const LIVE_HOSTS = (
  import.meta.env.VITE_META_PIXEL_HOSTS || "perfumira.net,www.perfumira.net"
)
  .split(",")
  .map((host: string) => host.trim().toLowerCase())
  .filter(Boolean)

/** Meta standard events this site sends. */
export type MetaEvent =
  | "PageView"
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "Lead"

export interface MetaContent {
  id: string
  quantity: number
  item_price?: number
}

export interface MetaEventParams {
  content_ids?: string[]
  content_name?: string
  content_type?: "product" | "product_group"
  content_category?: string
  contents?: MetaContent[]
  currency?: string
  value?: number
  num_items?: number
}

/** One recorded call, for the preview log. */
export interface MetaEventRecord {
  event: MetaEvent
  params?: MetaEventParams
  eventID?: string
  at: number
}

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  push: Fbq
  loaded: boolean
  version: string
  disablePushState?: boolean
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
    __metaPixelEvents?: MetaEventRecord[]
  }
}

type Mode = "live" | "preview"
let mode: Mode | undefined

function hostIsLive() {
  try {
    return import.meta.env.PROD && LIVE_HOSTS.includes(window.location.hostname.toLowerCase())
  } catch {
    return false
  }
}

/** Meta's base code: the queueing `fbq` stub the real script takes over. */
function installQueue(): Fbq {
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  } as Fbq
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = "2.0"
  fbq.queue = []
  window.fbq = fbq
  window._fbq ??= fbq
  return fbq
}

function loadScriptWhenIdle() {
  const inject = () => {
    try {
      if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return
      const script = document.createElement("script")
      script.async = true
      script.src = SCRIPT_SRC
      // Blocked (ad blocker, network): events stay queued and are never sent.
      script.onerror = () => script.remove()
      document.head.appendChild(script)
    } catch {
      /* The shop works without it. */
    }
  }
  const whenIdle = () => {
    if (typeof window.requestIdleCallback === "function")
      window.requestIdleCallback(inject, { timeout: 3000 })
    else setTimeout(inject, 1500)
  }
  if (document.readyState === "complete") whenIdle()
  else window.addEventListener("load", whenIdle, { once: true })
}

/** Sets the pixel up once per page load (main.tsx). Safe to call again. */
export function initMetaPixel() {
  if (mode) return
  try {
    if (!hostIsLive()) {
      mode = "preview"
      window.__metaPixelEvents ??= []
      return
    }
    // Never a second copy: an fbq that already exists (another install) is
    // left alone and used as it is.
    const existing = window.fbq
    mode = "live"
    if (existing) return
    const fbq = installQueue()
    fbq.disablePushState = true
    fbq("set", "autoConfig", false, META_PIXEL_ID)
    fbq("init", META_PIXEL_ID)
    loadScriptWhenIdle()
  } catch {
    mode = "preview"
  }
}

/**
 * Sends one event to this pixel only (`trackSingle`), never throwing.
 * `eventID` lets Meta drop a duplicate of the same action (and match a
 * future server-side Conversions API event).
 */
export function trackMetaEvent(
  event: MetaEvent,
  params?: MetaEventParams,
  eventID?: string,
) {
  try {
    if (!mode) initMetaPixel()
    const record: MetaEventRecord = { event, params, eventID, at: Date.now() }
    if (mode === "preview") {
      window.__metaPixelEvents?.push(record)
      console.info(`[Meta Pixel preview: not sent] ${event}`, params ?? {}, eventID ?? "")
      return
    }
    const args: unknown[] = ["trackSingle", META_PIXEL_ID, event, params ?? {}]
    if (eventID) args.push({ eventID })
    window.fbq?.(...args)
  } catch {
    /* Tracking never interrupts the shop. */
  }
}

/*
 * Once per real action. React may run an effect twice (Strict Mode in
 * development) or re-render it many times; a key already sent is skipped.
 * Keys can also be kept for the browser tab (sessionStorage), so a reload
 * of a page does not repeat a one-time event such as an order request.
 */
const sentKeys = new Set<string>()
const TAB_KEY = "perfumira:meta-sent"

function tabKeys(): string[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TAB_KEY) ?? "[]")
    return Array.isArray(saved) ? saved.filter((key) => typeof key === "string") : []
  } catch {
    return []
  }
}

/** Runs `send` unless this key was already sent (in this page, or this tab when `forTab`). */
export function onceMeta(key: string, send: () => void, forTab = false) {
  if (sentKeys.has(key)) return
  if (forTab && tabKeys().includes(key)) return
  sentKeys.add(key)
  if (forTab) {
    try {
      sessionStorage.setItem(TAB_KEY, JSON.stringify([...tabKeys(), key].slice(-50)))
    } catch {
      /* Storage off: this page load still sends it only once. */
    }
  }
  send()
}

/** A whole-unit price for Meta (EGP has no minor units on this site). */
export const metaAmount = (value: number) =>
  Number.isFinite(value) ? Math.round(value * 100) / 100 : 0

/** The company product id Meta should know a product by (no option suffix). */
export const metaContentId = (product: { id: string; productId?: number }) =>
  product.productId !== undefined ? String(product.productId) : product.id.split("~")[0]
