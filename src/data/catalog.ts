import type { ImageAsset } from "@/types/content"
import type { PriceRange, Product } from "@/types/catalog"
import { unsplashImage } from "./mockImages"

/*
 * Temporary mock catalogue. Replace with the product API mapped to `Product`.
 *
 * PLACEHOLDER ASSETS: the packshots are third-party branded bottles used only
 * as design stand-ins (and `nocturne-rose` is low resolution). All must be
 * replaced with approved Perfumeria product photography before launch.
 * Family, gender and stock values are mock data for the catalogue filters.
 * The text here is English; Arabic notes and stories are in i18n/ar/catalog.ts
 * and data/productStories.ar.ts.
 */

const editorialImage = (photoId: string, alt: string) =>
  unsplashImage(photoId, alt, { width: 700, widths: [400, 700, 1000] })

const packshot = (file: string, name: string): ImageAsset => ({
  src: `${import.meta.env.BASE_URL}images/packshots/${file}.webp`,
  alt: `${name} perfume bottle`,
})

const catalogEntries: Product[] = [
  {
    id: "velvet-iris",
    slug: "velvet-iris",
    name: "Velvet Iris",
    notes: ["Iris", "White Musk"],
    size: "50ml",
    price: 138,
    compareAtPrice: 168,
    currency: "USD",
    family: "floral",
    gender: "women",
    inStock: true,
    image: editorialImage("1588405748880-12d1d2a59f75", "Velvet Iris perfume"),
    packshot: packshot("velvet-iris", "Velvet Iris"),
  },
  {
    id: "nocturne-rose",
    slug: "nocturne-rose",
    name: "Nocturne Rose",
    notes: ["Rose", "Amber"],
    size: "75ml",
    price: 156,
    compareAtPrice: 192,
    currency: "USD",
    family: "floral",
    gender: "women",
    inStock: true,
    image: editorialImage(
      "1608721279136-cd41b752fa41",
      "Nocturne Rose perfume",
    ),
    packshot: packshot("nocturne-rose", "Nocturne Rose"),
  },
  {
    id: "santal-lumiere",
    slug: "santal-lumiere",
    name: "Santal Lumière",
    notes: ["Sandalwood", "Fig"],
    size: "50ml",
    price: 142,
    compareAtPrice: 175,
    currency: "USD",
    family: "woody",
    gender: "unisex",
    inStock: true,
    image: editorialImage("1547887537-6158d64c35b3", "Santal Lumière perfume"),
    packshot: packshot("santal-lumiere", "Santal Lumière"),
  },
  {
    id: "quiet-oud",
    slug: "quiet-oud",
    name: "Quiet Oud",
    notes: ["Oud", "Cedar"],
    size: "75ml",
    price: 179,
    compareAtPrice: 210,
    currency: "USD",
    family: "woody",
    gender: "men",
    inStock: true,
    image: editorialImage("1607506740211-ff3d6b933dda", "Quiet Oud perfume"),
    packshot: packshot("quiet-oud", "Quiet Oud"),
  },
  {
    id: "amber-reverie",
    slug: "amber-reverie",
    name: "Amber Reverie",
    notes: ["Amber", "Tonka"],
    size: "50ml",
    price: 152,
    compareAtPrice: 184,
    currency: "USD",
    family: "amber",
    gender: "unisex",
    inStock: true,
    packshot: packshot("amber-reverie", "Amber Reverie"),
  },
  {
    id: "fleur-de-peau",
    slug: "fleur-de-peau",
    name: "Fleur de Peau",
    notes: ["Neroli", "Suede"],
    size: "75ml",
    price: 164,
    compareAtPrice: 198,
    currency: "USD",
    family: "floral",
    gender: "women",
    inStock: true,
    packshot: packshot("fleur-de-peau", "Fleur de Peau"),
  },
  {
    id: "cedar-veil",
    slug: "cedar-veil",
    name: "Cedar Veil",
    notes: ["Cedar", "Bergamot"],
    size: "50ml",
    price: 145,
    compareAtPrice: 172,
    currency: "USD",
    family: "woody",
    gender: "men",
    inStock: true,
    packshot: packshot("cedar-veil", "Cedar Veil"),
  },
  {
    id: "eau-de-minuit",
    slug: "eau-de-minuit",
    name: "Eau de Minuit",
    notes: ["Incense", "Vanilla"],
    size: "75ml",
    price: 188,
    compareAtPrice: 220,
    currency: "USD",
    family: "amber",
    gender: "men",
    inStock: false,
    packshot: packshot("eau-de-minuit", "Eau de Minuit"),
  },
]

/**
 * Shared catalogue records. Price, stock, size, ids and names are the same in
 * every language; descriptive fields (notes, stories, image text) are
 * localised by services/catalog.ts, which components use instead of this.
 */
export const catalog: Product[] = catalogEntries

/** Price bands for the Price filter; labels are built per language. */
export const priceRanges: PriceRange[] = [
  { id: "under-150", max: 150 },
  { id: "150-175", min: 150, max: 175 },
  { id: "over-175", min: 175 },
]

/** Homepage "Offers for This Season" selection. */
export const featuredProductIds = [
  "velvet-iris",
  "nocturne-rose",
  "santal-lumiere",
  "quiet-oud",
]
