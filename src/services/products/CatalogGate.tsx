import { useEffect, useState, type ReactNode } from "react"
import { dismissBootScreen } from "../../lib/bootScreen"
import { initializeCatalog, productSource } from "../catalog"
import DevCatalogBadge from "./DevCatalogBadge"

/** Hydrates once before existing synchronous consumers mount. Mock mode is immediate. */
export default function CatalogGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    productSource === "mock" ? "ready" : "loading",
  )
  const [attempt, setAttempt] = useState(0)
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
  // The startup screen (index.html) covers the wait; it goes as soon as there
  // is something to show: the site, or the error with Retry.
  useEffect(() => {
    if (status !== "loading") dismissBootScreen()
  }, [status])
  if (status === "ready")
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
