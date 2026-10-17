/*
 * Transparent bottle cut-outs for live company products, keyed by company
 * product id. The company only supplies styled photographs (backdrop, box,
 * logo), so a product needs an entry here before Hero C can show it.
 *
 * Made 2026-10-18 from the company photos: background removed, only the
 * bottle kept, trimmed and saved as WebP with alpha. To add one, put
 * `<id>.webp` in public/images/hero/cutouts and list it with its pixel size.
 */
export interface HeroCutout {
  src: string
  width: number
  height: number
}

const cutout = (id: number, width: number, height: number): HeroCutout => ({
  src: `/images/hero/cutouts/${id}.webp`,
  width,
  height,
})

export const LIVE_HERO_CUTOUTS: Record<number, HeroCutout> = {
  // Yves Saint Laurent Mon Paris Eau de Parfum
  14097: cutout(14097, 474, 695),
  // Dior J'adore Eau de Parfum
  14075: cutout(14075, 346, 800),
  // Jean Paul Gaultier Scandal Pour Homme Le Parfum
  13977: cutout(13977, 298, 510),
}
