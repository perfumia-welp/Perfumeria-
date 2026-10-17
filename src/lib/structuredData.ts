import { useEffect } from "react"

/*
 * Page-level JSON-LD. Like documentMeta.ts, it is written into <head> on the
 * client while the page is shown and removed when the visitor leaves it, so
 * a page never carries another page's structured data.
 */

/** Adds `data` as a JSON-LD script while the calling page is mounted; null adds none. */
export function useStructuredData(id: string, data: object | null) {
  // "<" is escaped so text can never close the script element early.
  const json = data ? JSON.stringify(data).replace(/</g, "\\u003c") : null

  useEffect(() => {
    if (!json) return
    const script = document.createElement("script")
    script.type = "application/ld+json"
    script.id = id
    script.textContent = json
    document.head.append(script)
    return () => script.remove()
  }, [id, json])
}
