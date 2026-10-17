import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import App from "./App"
import { prefetchPages } from "./router/router"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

window.addEventListener("load", prefetchPages, { once: true })
