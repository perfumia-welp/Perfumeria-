import { lazy, Suspense, useEffect, useState } from "react"
import { useLocation } from "react-router"
import { stripLocale } from "@/i18n/locales"
import { paths } from "@/router/paths"

/*
 * Decides whether this visit shows the Offer Spotlight, and loads it only
 * then. The card's code, styles and bottle images are a separate chunk
 * requested after the page has finished loading (plus a short pause), so
 * they never compete with the page's own first paint.
 *
 * Shown once per browser session: dismissing it (close, Escape, backdrop
 * or a call to action) is remembered in sessionStorage, so it stays closed
 * while the visitor moves around the site; a new browser session may show
 * it again. Never over the bag, checkout, account or sign-in pages.
 */

const OfferSpotlight = lazy(() => import("./OfferSpotlight"))

const DISMISSED_KEY = "perfumira:offer-spotlight-dismissed"

/** Pause after the page's `load` before the card's chunk is requested. */
const OPEN_DELAY_MS = 1200

/** Pages the card never opens over (transactional or personal). */
const QUIET_PAGES: string[] = [
  paths.cart,
  paths.checkout,
  paths.account,
  paths.signIn,
  paths.signUp,
  paths.forgotPassword,
  paths.resetPassword,
]

const isQuietPage = (page: string) =>
  QUIET_PAGES.some((quiet) => page === quiet || page.startsWith(`${quiet}/`))

/*
 * Dev server only, for design review: `?spotlight` shows the card again in
 * this session; `?spotlight=2` also opens it on the second offer. Compiled
 * out of every build (`import.meta.env.DEV` is false there).
 */
const devRequest: string | null = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get("spotlight")
  : null

function wasDismissed() {
  if (devRequest !== null) return false
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1"
  } catch {
    return false
  }
}

function rememberDismissed() {
  try {
    sessionStorage.setItem(DISMISSED_KEY, "1")
  } catch {
    // Storage blocked: the card simply closes for this page view.
  }
}

type GateState = "waiting" | "ready" | "done"

export default function OfferSpotlightGate() {
  const { pathname } = useLocation()
  const eligible = !isQuietPage(stripLocale(pathname).replace(/\/+$/, "") || "/")
  const [state, setState] = useState<GateState>(() =>
    wasDismissed() ? "done" : "waiting",
  )

  useEffect(() => {
    if (state !== "waiting" || !eligible) return
    let timer: number | undefined
    const start = () => {
      timer = window.setTimeout(() => setState("ready"), OPEN_DELAY_MS)
    }
    if (document.readyState === "complete") start()
    else window.addEventListener("load", start, { once: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("load", start)
    }
  }, [state, eligible])

  if (state !== "ready") return null
  return (
    <Suspense fallback={null}>
      <OfferSpotlight
        eligible={eligible}
        initialSlide={devRequest === "2" ? 1 : 0}
        onDismissed={rememberDismissed}
        onClosed={() => setState("done")}
      />
    </Suspense>
  )
}
