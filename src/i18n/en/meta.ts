/*
 * Document titles and meta descriptions per route (see the route `handle`s).
 * A page's <title> is `documentTitle` when given (owner SEO wording, used as
 * is), otherwise "title | siteTitle". siteTitle is the brand as written in
 * the owner's SEO strategy (config/site.ts). Keep `pages.home` in step with
 * .figma/make/site.json, the static fallback for crawlers without JavaScript.
 * Only facts the site can stand behind: no unisex, oud or price-band claims.
 */
export default {
  siteTitle: "Perfumira",
  siteDescription:
    "Shop men's and women's perfumes online in Egypt at Perfumira, a perfume importer and distributor since 1997. Prices in Egyptian pounds.",
  pages: {
    home: {
      // Owner SEO strategy (2026-10-17).
      title: "Shop Perfumes Online in Egypt",
      documentTitle: "Perfumira | Shop Perfumes Online in Egypt",
      description:
        "Shop men's and women's perfumes online in Egypt at Perfumira, a perfume importer and distributor since 1997. Prices in Egyptian pounds.",
    },
    products: {
      title: "All Perfumes",
      documentTitle: "All Perfumes: Men's & Women's Fragrances | Perfumira",
      description:
        "Browse the full Perfumira perfume collection for men and women, with prices in Egyptian pounds and availability for every fragrance.",
    },
    menPerfumes: {
      // Owner SEO strategy (2026-10-17).
      title: "Men's Perfumes",
      documentTitle: "Men's Perfumes in Egypt | Perfumira",
      description:
        "Shop men's perfumes online at Perfumira. Browse every men's fragrance in the collection with prices in Egyptian pounds.",
    },
    womenPerfumes: {
      // Owner SEO strategy (2026-10-17).
      title: "Women's Perfumes",
      documentTitle: "Women's Perfumes in Egypt | Perfumira",
      description:
        "Shop women's perfumes online at Perfumira. Browse every women's fragrance in the collection with prices in Egyptian pounds.",
    },
    about: {
      // From the owner-approved About copy (2026-10-17).
      title: "Perfume Importer & Distributor in Egypt, Since 1997",
      description:
        "Perfumira began distributing perfumes across Egypt in 1997 and has grown into a perfume importer and distributor offering more than 450 fragrances.",
    },
    contact: {
      title: "Contact Us",
      documentTitle: "Contact Perfumira | Orders & Wholesale Inquiries",
      description:
        "Contact Perfumira about an order, a fragrance or wholesale perfume inquiries in Egypt.",
    },
    faq: {
      // Owner-provided SEO settings (2026-10-17).
      title: "Frequently Asked Questions",
      documentTitle: "Perfume FAQs & Wholesale Questions | Perfumira",
      description:
        "Find answers about Perfumira's perfume collection, product quality, ordering, delivery, and wholesale perfume inquiries in Egypt.",
    },
    wishlist: {
      title: "Wishlist",
      description: "The fragrances you’ve saved at Perfumira.",
    },
    cart: {
      title: "Shopping Bag",
      description: "Review the fragrances in your Perfumira shopping bag.",
    },
    checkout: {
      title: "Checkout",
      description:
        "Send an order request; the Perfumira team confirms availability, delivery and the final total with you.",
    },
    account: {
      title: "My Account",
      description: "Your Perfumira account: orders, saved fragrances and details.",
    },
    signIn: {
      title: "Sign In",
      description: "Sign in to your Perfumira account or create one.",
    },
    signUp: {
      title: "Create an Account",
      description: "Sign in to your Perfumira account or create one.",
    },
    forgotPassword: {
      title: "Forgot Password",
      description: "Sign in to your Perfumira account or create one.",
    },
    resetPassword: {
      title: "Reset Password",
      description: "Sign in to your Perfumira account or create one.",
    },
    notFound: {
      title: "Page Not Found",
      description:
        "This page could not be found. Continue exploring Perfumira.",
    },
  },
  /** Product pages, from the product's own data only. */
  product: {
    /** "Dior Sauvage 100 ml – Price & Details | Perfumira"; `reference` only tells same-named products apart. */
    title: (name: string, size?: string, reference?: string) =>
      `${name}${size ? ` ${size}` : ""}${reference ? ` (Ref. ${reference})` : ""} – Price & Details | Perfumira`,
    /** Opening of the meta description, followed by an excerpt of the product's description. */
    summary: (
      name: string,
      size: string | undefined,
      kind: string,
      price: string,
      inStock: boolean,
    ) =>
      `${name}${size ? ` ${size}` : ""}, ${kind} at Perfumira. ${price}. ${inStock ? "In stock" : "Currently out of stock"}.`,
    /** What the product is, by the company category. */
    kinds: {
      men: "men's perfume",
      women: "women's perfume",
      unisex: "unisex perfume",
      other: "perfume",
    },
    price: (amount: string) => `Price ${amount}`,
    priceFrom: (amount: string) => `From ${amount}`,
  },
  /** Visible breadcrumb names used in structured data. */
  breadcrumb: {
    home: "Home",
  },
}
