/*
 * Returns & Exchanges page. The policy is the owner-approved Arabic text
 * (ar/returns.ts, supplied 2026-10-17); this English copy is a literal
 * translation of exactly the same five terms. Do not add conditions here
 * (return windows, refunds, exclusions) that the Arabic policy does not state.
 */
export default {
  intro: {
    eyebrow: "Customer Care",
    title: "Returns & Exchanges",
    lead: "The following terms apply to exchange and return requests for orders placed online.",
  },
  policyTitle: "Exchange and Return Policy for Online Orders",
  /** Shown under the policy title; empty in the original (Arabic) language. */
  translationNote:
    "This English text is a translation of Perfumira’s official Arabic policy.",
  /** Highlighted wherever it appears in a term; must match the term text exactly. */
  fee: "EGP 140",
  terms: [
    "Exchange or return requests are accepted only on the day the order is received from the delivery representative or on the following day, with photographs showing the issue.",
    "The product must be returned in the same condition in which it was received.",
    "The customer bears the cost of shipping the product to one of the Perfumira offices specified by the company.",
    "If the product box or the original factory plastic wrapping has been opened, a fee of EGP 140 applies.",
    "The customer must ensure that the address, phone number and any important notes for the delivery representative are correct, and must be easy to reach by the delivery representative at the time of delivery.",
  ],
  termsLabel: "Policy terms",
  help: {
    title: "Need help with a return or exchange?",
    text: "Our customer service team can help you with an exchange or return request for your online order.",
    contact: "Contact Us",
    faq: "Read the FAQs",
  },
}
