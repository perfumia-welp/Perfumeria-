import type { Messages } from "../messages"
import { fragrances } from "./plural"

export default {
  optional: "اختياري",
  close: "إغلاق",
  sending: "جارٍ الإرسال…",
  genericError: "حدث خطأ ما. يُرجى المحاولة مرة أخرى.",
  listSeparator: "، ",
  millilitres: "مل",
  compactSize: (size: string) => size.replace(/ml$/, " مل"),
  fragranceCount: fragrances,
  price: {
    original: "السعر الأصلي",
    sale: "، السعر بعد الخصم",
    /** Before a price-changing option is chosen: "From EGP 900". */
    from: "ابتداءً من",
  },
  quantity: {
    group: (name: string) => `الكمية، ${name}`,
    current: "الكمية ",
    decrease: "إنقاص الكمية",
    increase: "زيادة الكمية",
  },
} satisfies Messages["common"]
