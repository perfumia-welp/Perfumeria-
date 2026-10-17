import type { ImageAsset } from "@/types/content"

const UNSPLASH_BASE = "https://images.unsplash.com/photo-"

interface UnsplashOptions {
  /** Width of the fallback `src`. */
  width: number
  quality?: number
  /** Widths offered in `srcSet`. */
  widths?: number[]
}

/**
 * Builds a responsive Unsplash image for the temporary mock photography.
 * Replace with real product/editorial assets once they are available.
 */
export function unsplashImage(
  photoId: string,
  alt: string,
  { width, quality = 85, widths = [] }: UnsplashOptions,
): ImageAsset {
  const url = (w: number) =>
    `${UNSPLASH_BASE}${photoId}?auto=format&fit=crop&w=${w}&q=${quality}`

  return {
    src: url(width),
    srcSet: widths.length
      ? widths.map((w) => `${url(w)} ${w}w`).join(", ")
      : undefined,
    alt,
  }
}
