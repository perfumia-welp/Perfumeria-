import type { ProductStory } from "@/types/catalog"

/*
 * TEMPORARY CONTENT — placeholder product-page copy for the mock catalogue.
 * Replace with the descriptions and note pyramids from the product API.
 *
 * The products are fictional Perfumeria names. Each composition keeps the
 * catalogue's two key notes (shown on cards and used by search); the other
 * notes, descriptions and character words are illustrative only and make no
 * claims about any real third-party fragrance. The Arabic version is
 * productStories.ar.ts; both are applied by the catalogue adapter.
 */
export const productStories = {
  "velvet-iris": {
    description:
      "A powdery iris softened by white musk, quiet and close to the skin. Composed to feel like the hush of a cashmere sleeve.",
    composition: {
      top: ["Bergamot", "Pink Pepper"],
      heart: ["Iris", "Violet Leaf"],
      base: ["White Musk", "Cashmere Wood"],
    },
    character: ["Powdery", "Soft", "Intimate"],
  },
  "nocturne-rose": {
    description:
      "A dark rose that unfolds slowly after dusk, its petals warmed by a resinous amber trail.",
    composition: {
      top: ["Blackcurrant", "Saffron"],
      heart: ["Rose", "Geranium"],
      base: ["Amber", "Patchouli"],
    },
    character: ["Deep", "Romantic", "Evening"],
  },
  "santal-lumiere": {
    description:
      "Creamy sandalwood lit from within by green fig, a woody composition with an easy, sunlit warmth.",
    composition: {
      top: ["Fig Leaf", "Cardamom"],
      heart: ["Fig", "Orris"],
      base: ["Sandalwood", "Musk"],
    },
    character: ["Creamy", "Luminous", "Relaxed"],
  },
  "quiet-oud": {
    description:
      "Oud handled with restraint, framed by dry cedar for a smoky composition that speaks softly.",
    composition: {
      top: ["Elemi", "Black Pepper"],
      heart: ["Oud", "Leather"],
      base: ["Cedar", "Vetiver"],
    },
    character: ["Smoky", "Composed", "Resinous"],
  },
  "amber-reverie": {
    description:
      "A golden amber wrapped in tonka, sweet and enveloping, made for slow evenings and long conversations.",
    composition: {
      top: ["Mandarin", "Clove"],
      heart: ["Amber", "Labdanum"],
      base: ["Tonka", "Benzoin"],
    },
    character: ["Warm", "Enveloping", "Golden"],
  },
  "fleur-de-peau": {
    description:
      "Bright neroli resting on supple suede: a floral that feels like skin warmed by the sun.",
    composition: {
      top: ["Neroli", "Petitgrain"],
      heart: ["Orange Blossom", "Jasmine"],
      base: ["Suede", "Ambrette"],
    },
    character: ["Radiant", "Tender", "Polished"],
  },
  "cedar-veil": {
    description:
      "Crisp bergamot over pencil-shaving cedar, clean and upright, with a fresh, aromatic lift.",
    composition: {
      top: ["Bergamot", "Lemon Zest"],
      heart: ["Lavender", "Juniper"],
      base: ["Cedar", "Oakmoss"],
    },
    character: ["Fresh", "Clean", "Aromatic"],
  },
  "eau-de-minuit": {
    description:
      "Incense curling through vanilla at midnight: a contemplative amber with a quiet, smoky sweetness.",
    composition: {
      top: ["Pink Pepper", "Elemi"],
      heart: ["Incense", "Myrrh"],
      base: ["Vanilla", "Guaiac Wood"],
    },
    character: ["Mystical", "Smoky", "Sweet"],
  },
} satisfies Record<string, ProductStory>
