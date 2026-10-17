import { useCatalogState } from "@/hooks/useCatalogState"
import { getSkippedProductCount, productSource } from "../catalog"

/*
 * DEVELOPMENT ONLY: shows which catalogue this dev tab uses and switches to
 * the other one. The link reloads with ?catalog=live / ?catalog=mock, which
 * the dev source logic keeps for the tab (sessionStorage), so the choice
 * survives navigation and refresh. CatalogGate renders it only on the Vite
 * dev server; production builds never include it.
 */
export default function DevCatalogBadge() {
  const catalog = useCatalogState()
  const live = productSource === "live"
  const skipped = live ? getSkippedProductCount() : 0
  const other = new URL(window.location.href)
  other.searchParams.set("catalog", live ? "mock" : "live")
  return (
    <div
      role="note"
      aria-label={`Development: ${live ? "live" : "mock"} catalogue`}
      style={{
        position: "fixed",
        insetBlockEnd: 8,
        insetInlineStart: 8,
        zIndex: 2147483000,
        background: live ? "#7a1f1f" : "#3b3a36",
        color: "#fff",
        font: "600 11px/1.4 system-ui, sans-serif",
        letterSpacing: "0.04em",
        padding: "4px 8px",
        borderRadius: 4,
        boxShadow: "0 2px 6px rgb(0 0 0 / 0.25)",
      }}
      dir="ltr"
    >
      {live ? (
        <>
          LIVE CATALOGUE · {catalog.total} products
          {catalog.complete ? "" : " (first page loaded)"}
          {skipped ? ` · ${skipped} skipped` : ""} ·{" "}
        </>
      ) : (
        "MOCK CATALOGUE · "
      )}
      <a href={other.href} style={{ color: "#fff", textDecoration: "underline" }}>
        {live ? "use mock" : "use live"}
      </a>
    </div>
  )
}
