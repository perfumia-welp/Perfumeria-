import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import App from "./App"
import { fallBackToOriginalImages } from "./lib/imageFallback"
import { initMetaPixel } from "./lib/metaPixel"
import { prefetchPages } from "./router/router"
import { initializeCatalog } from "./services/catalog"

// Start the catalogue now, in parallel with React's first render, rather than
// from CatalogGate's effect once the tree has mounted.
void initializeCatalog().catch(() => {})
fallBackToOriginalImages()
// Meta Pixel queue now; Meta's script itself only once the page has loaded.
initMetaPixel()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

window.addEventListener("load", prefetchPages, { once: true })
