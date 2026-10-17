import { contactAbout, paths } from "@/router/paths"

/*
 * Owner-approved FAQ copy (English only, supplied 2026-10-17). Text is kept
 * as approved, including the owner's "Perfumira" spelling. The owner struck
 * seven questions from the draft; they are deliberately absent, and the
 * delivery-time answer carries the owner's handwritten correction (3–5 days).
 *
 * Answers are runs of text and links. A link is used only where the answer
 * names a page that exists: the published returns policy links to /returns;
 * there is no shipping page yet, so that phrase stays plain text.
 */

export interface FaqLink {
  text: string
  /** An English app path; AppLink keeps it in the current language. */
  href: string
}

export type FaqRichText = Array<string | FaqLink>

export interface FaqQuestion {
  /** Stable anchor, e.g. /faq#delivery-time. */
  id: string
  question: string
  answer: FaqRichText
}

export interface FaqGroup {
  id: string
  title: string
  questions: FaqQuestion[]
}

export interface FaqContent {
  title: string
  intro: string
  /** Closing sentence of the intro, with its link. */
  assistance: FaqRichText
  groups: FaqGroup[]
  closing: {
    title: string
    lines: string[]
    actions: {
      products: FaqLink
      wholesale: FaqLink
      contact: FaqLink
    }
  }
}

const contactTeam = (text: string): FaqLink => ({ text, href: paths.contact })
const wholesaleTeam = (text: string): FaqLink => ({
  text,
  href: contactAbout("wholesale"),
})
const catalogue = (text: string): FaqLink => ({ text, href: paths.products })

export const faq: FaqContent = {
  title: "Frequently Asked Questions",
  intro:
    "Welcome to Perfumira’s Frequently Asked Questions page. Whether you’re shopping for your next favorite fragrance or looking for a reliable perfume supplier for your business, you’ll find answers to common questions about our products, ordering, and wholesale services below.",
  assistance: [
    "If you need further assistance, please ",
    contactTeam("contact our team"),
    ".",
  ],
  groups: [
    {
      id: "about-perfumira",
      title: "About Perfumira",
      questions: [
        {
          id: "what-is-perfumira",
          question: "What is Perfumira?",
          answer: [
            "Perfumira is an Egyptian perfume importing and distribution business with a history dating back to 1997. We offer a diverse collection of more than 450 perfume varieties, including European and Eastern fragrances, with a strong commitment to quality and variety.",
          ],
        },
        {
          id: "types-of-perfumes",
          question: "What types of perfumes does Perfumira offer?",
          answer: [
            catalogue("Our selection"),
            " includes a wide variety of European and Eastern fragrances, with different scent styles to suit different preferences. Our collection covers a broad range of fragrance profiles, from fresh and floral scents to woody, oriental, and other distinctive aromas.",
          ],
        },
      ],
    },
    {
      id: "quality-and-selection",
      title: "Perfume Quality and Selection",
      questions: [
        {
          id: "product-quality",
          question: "How does Perfumira approach product quality?",
          answer: [
            "Quality is one of our core values. We pay close attention to our product selection and supplier relationships, aiming to offer a diverse fragrance range that meets our quality standards and our customers’ expectations.",
          ],
        },
        {
          id: "find-the-right-perfume",
          question: "How can I find the right perfume for me?",
          answer: [
            "Consider the fragrance styles you enjoy, the occasions when you plan to wear the perfume, and whether you prefer fresh, floral, sweet, woody, or oriental scents. You can ",
            catalogue("browse our available products"),
            " or ",
            contactTeam("contact our team"),
            " for help exploring suitable options.",
          ],
        },
        {
          id: "available-sizes",
          question: "Are all perfumes available in every size?",
          answer: [
            "Available sizes depend on the individual product. Please check the product page or ",
            catalogue("current catalog"),
            " for the sizes offered for each fragrance.",
          ],
        },
      ],
    },
    {
      id: "orders-and-shopping",
      title: "Orders and Shopping",
      questions: [
        {
          id: "browse-the-collection",
          question: "How can I browse Perfumira’s perfume collection?",
          answer: [
            "You can explore our website’s ",
            catalogue("product categories"),
            " and individual product pages to discover available fragrances, review product details, and check current prices and sizes.",
          ],
        },
        {
          id: "place-an-order",
          question: "How can I place an order?",
          answer: [
            "Please follow the ordering instructions on the relevant ",
            catalogue("product page"),
            " or checkout. If you need assistance with a product or your order, contact our ",
            contactTeam("customer service team"),
            ".",
          ],
        },
        {
          id: "help-choosing",
          question: "Can I ask for help choosing a perfume?",
          answer: [
            "Yes. ",
            contactTeam("Contact our team"),
            " and tell us about your preferred fragrance styles, intended use, and budget. We’ll help you explore the available options.",
          ],
        },
      ],
    },
    {
      id: "wholesale",
      title: "Wholesale Perfumes and Business Inquiries",
      questions: [
        {
          id: "wholesale-supply",
          question: "Does Perfumira supply perfumes wholesale?",
          answer: [
            "Perfumira has a long history in perfume distribution throughout Egypt and has expanded into perfume importing and distribution. For current wholesale availability, ordering conditions, and pricing, please contact our ",
            wholesaleTeam("wholesale team"),
            ".",
          ],
        },
        {
          id: "who-can-inquire",
          question: "Who can inquire about wholesale perfumes?",
          answer: [
            "Perfume retailers, shop owners, resellers, and other businesses interested in sourcing fragrances can ",
            wholesaleTeam("contact our team"),
            " to discuss their requirements and available products.",
          ],
        },
        {
          id: "wholesale-prices",
          question: "How can I request wholesale prices?",
          answer: [
            wholesaleTeam("Contact our team"),
            " with your business requirements, the products you’re interested in, and the approximate quantities you need. Our team can provide information about applicable pricing and ordering conditions.",
          ],
        },
        {
          id: "perfume-catalog",
          question: "Can I request a perfume catalog?",
          answer: [
            wholesaleTeam("Contact our team"),
            " to request the latest available catalog and information about the products, sizes, and wholesale ordering options currently offered.",
          ],
        },
      ],
    },
    {
      id: "delivery-returns-support",
      title: "Delivery, Returns and Customer Support",
      questions: [
        {
          id: "delivery-cost",
          question: "How much does delivery cost?",
          answer: [
            "Delivery fees depend on the applicable delivery arrangements and your location. Please review the shipping information on our website or ",
            contactTeam("contact our team"),
            " for the current charges before placing your order.",
          ],
        },
        {
          id: "delivery-time",
          question: "How long does delivery take?",
          // Owner's handwritten correction: 3–5 days.
          answer: ["Delivery typically takes 3–5 days."],
        },
        {
          id: "damaged-or-incorrect-order",
          question:
            "What should I do if my order arrives damaged or incorrect?",
          answer: [
            "Please contact our ",
            contactTeam("customer service team"),
            " as soon as possible and provide your order details and relevant photographs, if available. Our team will explain the applicable process in accordance with ",
            { text: "Perfumira’s published policies", href: paths.returns },
            ".",
          ],
        },
        {
          id: "returns-and-exchanges",
          question: "Can I return or exchange a perfume?",
          answer: [
            "Returns and exchanges are subject to ",
            {
              text: "Perfumira’s published return and exchange policy",
              href: paths.returns,
            },
            " and the applicable conditions. Please review that policy or ",
            contactTeam("contact our team"),
            " before returning a product.",
          ],
        },
      ],
    },
  ],
  closing: {
    title: "Still Have Questions?",
    lines: [
      "We’re here to help you discover our fragrance collection and learn more about our wholesale services.",
      "Whether you’re choosing a perfume for yourself or sourcing products for your business, contact Perfumira for assistance.",
    ],
    actions: {
      products: { text: "Explore Our Perfumes", href: paths.products },
      wholesale: {
        text: "Wholesale Inquiries",
        href: contactAbout("wholesale"),
      },
      contact: { text: "Contact Us", href: paths.contact },
    },
  },
}

/** An answer as plain text (for structured data). */
export const plainText = (text: FaqRichText) =>
  text.map((part) => (typeof part === "string" ? part : part.text)).join("")
