import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import App from "./App"
import { fallBackToOriginalImages } from "./lib/imageFallback"
import { prefetchPages } from "./router/router"
import { initializeCatalog } from "./services/catalog"

// Start the catalogue now, in parallel with React's first render, rather than
// from CatalogGate's effect once the tree has mounted.
void initializeCatalog().catch(() => {})
fallBackToOriginalImages()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

window.addEventListener("load", prefetchPages, { once: true })
