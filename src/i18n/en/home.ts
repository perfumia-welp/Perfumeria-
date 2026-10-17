/*
 * Homepage copy. Images, links and product selection stay in data/home.ts;
 * only words live here. Slides and categories are keyed by their data id.
 */
export default {
  hero: {
    eyebrow: "The signature collection",
    heading: {
      lines: ["A Signature Scent", "For Every Moment"],
      emphasis: "Moment",
    },
    cta: "Explore Collection",
    slides: {
      floral: {
        mood: "Floral / Soft",
        notes: ["Iris", "Peony", "White Musk"],
        description:
          "Explore an exclusive collection of premium perfumes crafted to express elegance, confidence and individuality.",
        imageAlt: "Perfume bottle beside delicate flowers in warm light",
      },
      amber: {
        mood: "Warm / Amber",
        notes: ["Amber", "Vanilla", "Benzoin"],
        description:
          "Golden amber, soft vanilla and warm resins, composed to glow on skin from late afternoon into evening.",
        imageAlt: "Amber perfume bottle in warm light against ivory silk",
      },
      oud: {
        mood: "Oud / Night",
        notes: ["Oud", "Smoked Cedar", "Leather"],
        description:
          "Deep oud, smoked woods and supple leather: an intense, intimate trail made for the hours after dark.",
        imageAlt: "Black perfume bottle framed by deep red flowers",
      },
    },
  },
  carousel: {
    controls: "Slideshow controls",
    previous: "Previous slide",
    next: "Next slide",
    play: "Play slideshow",
    pause: "Pause slideshow",
    slide: (index: number, total: number, mood: string) =>
      `${index} of ${total}: ${mood}`,
    announcement: (index: number, total: number, mood: string) =>
      `Slide ${index} of ${total}: ${mood}`,
  },
  offers: {
    eyebrow: "The seasonal edit",
    title: "Offers for This Season",
    cta: "View All",
  },
  specialOffer: {
    eyebrow: "Private offer",
    heading: { lines: ["A Little Something", "Special"], emphasis: "Special" },
    description:
      "An invitation to discover your next signature. Enjoy 20% off a selected composition, reserved for our fragrance community.",
    discountLabel: "Enjoy 20% off",
    codeLabel: "Use code",
    cta: "Shop The Offer",
    imageAlt:
      "Perfume bottle under a spotlight on a dark stage, drifting gold dust",
    imageCaption: "Selected compositions",
  },
  categories: {
    eyebrow: "Find your expression",
    title: "Shop By Category",
    support: {
      eyebrow: "Discover your scent",
      title: "A fragrance for every expression.",
      description:
        "Explore fragrances composed for every character, every mood and every moment.",
      cta: "Explore All Fragrances",
    },
    label: "Collection",
    cta: "Explore",
    items: {
      women: { name: "Women", imageAlt: "Women fragrance collection" },
      men: { name: "Men", imageAlt: "Men fragrance collection" },
      unisex: { name: "Unisex", imageAlt: "Unisex fragrance collection" },
    },
  },
  instagram: {
    title: "Follow us on Instagram",
    description:
      "Discover new arrivals, fragrance stories and behind-the-scenes moments from Perfumeria.",
    cta: "Visit Instagram",
    view: "View on Instagram",
    posts: {
      arrivals: {
        label: "New arrivals",
        imageAlt: "Amber perfume bottle in warm light beside ivory silk",
      },
      stories: {
        label: "Fragrance stories",
        imageAlt: "Round perfume bottle on silk with dried flowers and rings",
      },
      backstage: {
        label: "Behind the scenes",
        imageAlt: "Black perfume bottle in front of deep red flowers",
      },
    },
  },
  testimonials: {
    eyebrow: "Notes from our community",
    title: "Scents remembered. Stories shared.",
    viewport: "Customer reviews, use the arrow keys to browse",
    previous: "Previous review",
    next: "Next review",
    slide: (index: number, total: number) => `${index} of ${total}`,
    announcement: (index: number, total: number) =>
      `Review ${index} of ${total}`,
    rating: (rating: number, max: number) => `${rating} out of ${max} stars`,
    quoted: (quote: string) => `“${quote}”`,
    items: {
      "amelia-laurent": {
        name: "Amelia Laurent",
        role: "Verified customer",
        quote:
          "Perfumeria turned choosing a fragrance into something deeply personal. Velvet Iris is quiet, assured, and unlike anything else I own.",
      },
      "julian-moreau": {
        name: "Julian Moreau",
        role: "Verified customer",
        quote:
          "A beautiful composition with extraordinary presence. It feels considered from the first note to the final trace on skin.",
      },
      "elise-martin": {
        name: "Elise Martin",
        role: "Verified customer",
        quote:
          "Nocturne Rose settles into something warm and intimate. I am asked what I am wearing every single time.",
      },
      "theo-bennett": {
        name: "Theo Bennett",
        role: "Verified customer",
        quote:
          "The discovery felt as considered as the fragrance itself. Quiet Oud has become part of every evening ritual.",
      },
      "sofia-rossi": {
        name: "Sofia Rossi",
        role: "Verified customer",
        quote:
          "Elegant without being expected. Santal Lumière wears beautifully and leaves the softest, most memorable trail.",
      },
    },
  },
}
