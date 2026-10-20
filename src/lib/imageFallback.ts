import { LIVE_CATALOG } from "@/config/catalog"

/*
 * Company product photos are offered resized through LIVE_CATALOG.imageResizer
 * (`srcSet`), with the original as `src`. If a resized version fails to load
 * (the resizer is down, or it refuses an image), that image drops its
 * `srcSet`, so the browser shows the original instead of a broken image.
 * One listener for the whole page: image errors do not bubble, so it listens
 * in the capture phase.
 */
export function fallBackToOriginalImages() {
  const resizer = LIVE_CATALOG.imageResizer
  if (!resizer) return
  window.addEventListener(
    "error",
    (event) => {
      const image = event.target
      if (
        image instanceof HTMLImageElement &&
        image.srcset &&
        image.currentSrc.startsWith(resizer)
      )
        image.removeAttribute("srcset")
    },
    true,
  )
}
