import { useEffect, useState, type ReactNode } from "react"
import { stripLocale } from "../../i18n/locales"
import { dismissBootScreen, showBootScreen } from "../../lib/bootScreen"
import { isListingPath } from "../../router/paths"
import { initializeCatalog, productSource } from "../catalog"
import DevCatalogBadge from "./DevCatalogBadge"

/** A visit that starts on a catalogue listing (the URL as the page opened). */
function startsOnListing() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "")
  const path = stripLocale(window.location.pathname.slice(base.length))
  return isListingPath(path.length > 1 ? path.replace(/\/+$/, "") : path)
}

/**
 * Hydrates once before existing synchronous consumers mount. Mock mode is
 * immediate. A visit that starts on a listing mounts at once instead: the page
 * shows its own placeholders, and any other page it navigates to waits in
 * SiteLayout. A failed load always comes back here, and a retry has no page to
 * show behind it, so it waits on the startup screen.
 */
export default function CatalogGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    productSource === "mock" ? "ready" : "loading",
  )
  const [attempt, setAttempt] = useState(0)
  // Fixed for the visit: navigating must never unmount the site mid-load.
  const [listingFirst] = useState(startsOnListing)
  useEffect(() => {
    if (productSource === "mock") return
    let active = true
    setStatus("loading")
    initializeCatalog().then(
      () => {
        if (active) setStatus("ready")
      },
      () => {
        if (active) setStatus("error")
      },
    )
    return () => {
      active = false
    }
  }, [attempt])
  // A phone that failed while offline loads again as soon as it is back online.
  useEffect(() => {
    if (status !== "error") return
    const retry = () => setAttempt((value) => value + 1)
    window.addEventListener("online", retry)
    return () => window.removeEventListener("online", retry)
  }, [status])
  // The startup screen (index.html) covers the wait; it goes as soon as there
  // is something to show: the site, or the error with Retry.
  useEffect(() => {
    if (status !== "loading") dismissBootScreen()
    else if (attempt > 0) showBootScreen()
  }, [status, attempt])
  if (status === "ready" || (status === "loading" && attempt === 0 && listingFirst))
    return import.meta.env.DEV ? (
      <>
        {children}
        <DevCatalogBadge />
      </>
    ) : (
      children
    )
  const ar = /(^|\/)ar(\/|$)/.test(window.location.pathname)
  return (
    <main
      lang={ar ? "ar" : "en"}
      dir={ar ? "rtl" : "ltr"}
      style={{ padding: "4rem", textAlign: "center" }}
    >
      <p
        role={status === "error" ? "alert" : "status"}
        // While loading, the startup screen is what sighted visitors see.
        className={status === "loading" ? "visually-hidden" : undefined}
      >
        {status === "error"
          ? ar
            ? "تعذر تحميل المنتجات. يرجى المحاولة مرة أخرى."
            : "The catalogue could not be loaded. Please try again."
          : ar
            ? "جارٍ تحميل المنتجات…"
            : "Loading the catalogue…"}
      </p>
      {status === "error" && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          {ar ? "إعادة المحاولة" : "Retry"}
        </button>
      )}
    </main>
  )
}
