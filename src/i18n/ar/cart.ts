import type { Messages } from "../messages"
import { pieces } from "./plural"

export default {
  intro: {
    eyebrow: "حقيبة التسوق",
    title: "اختياراتك",
  },
  itemCount: pieces,
  added: (name: string) => `تمت إضافة ${name} إلى حقيبتك`,
  addedForVisit: (name: string) =>
    `تمت إضافة ${name}. ستبقى حقيبتك لهذه الزيارة فقط؛ سجّل الدخول لحفظها.`,
  saveError: "تعذّر تحديث حقيبتك. يُرجى المحاولة مرة أخرى.",
  loading: "جارٍ تحميل حقيبتك…",
  unavailable: {
    name: "عطر في حقيبتك",
    note: "لم يعد متوفرًا، ولن يُضاف إلى طلبك.",
  },
  empty: {
    eyebrow: "حقيبتك فارغة",
    title: ["ما زال عطرك المميّز", "بانتظارك."],
    lead: "اكتشف عطورًا اخترناها لتعبّر عن الشخصية والمزاج والذكرى.",
    action: "اكتشف العطور",
  },
  continueShopping: "متابعة التسوق",
  itemsLabel: "القطع في حقيبتك",
  removed: (name: string) => `تمت إزالة ${name}.`,
  undo: "تراجع",
  line: {
    quantity: "الكمية",
    remove: "إزالة",
    removeLabel: (name: string) => `إزالة ${name}`,
    lineTotal: (total: string, quantity: number) => `${total} لعدد ${quantity}`,
  },
  gift: {
    toggle: "هذا الطلب هدية",
    label: "رسالة الإهداء (اختيارية)",
    placeholder: "أضف رسالة إهداء مجانية (اختيارية)",
  },
  summary: {
    title: "ملخص الطلب",
    subtotal: "المجموع الفرعي",
    shipping: "الشحن",
    tax: "الضريبة",
    calculatedAtCheckout: "تُحتسب عند إتمام الطلب",
    promoToggle: "هل لديك رمز خصم؟",
    promoLabel: "رمز الخصم",
    promoPlaceholder: "رمز الخصم",
    apply: "تطبيق",
    promoEmpty: "يُرجى إدخال رمز الخصم.",
    promoUnavailable: "لا يمكن تطبيق رموز الخصم بعد، ولم يتغيّر إجمالي طلبك.",
    total: "الإجمالي",
    fineprint: "يُحتسب الشحن عند إتمام الطلب.",
    proceed: "المتابعة لإتمام الطلب",
  },
  promotion: {
    name: "اشترِ 3 واحصل على الأقل سعرًا مجانًا",
    free: (free: number, quantity: number) =>
      free === quantity ? "مجانًا" : `${free} من ${quantity} مجانًا`,
    lineDiscount: (amount: string) => `−${amount}`,
    finalSubtotal: "المجموع الفرعي النهائي",
    // Only ever 1 or 2 (the bag has 1 or 2 units).
    progress: (units: number) =>
      `أضف ${units === 1 ? "قطعة أخرى" : "قطعتين أخريين"} واحصل على الأقل سعرًا مجانًا.`,
  },
  // Arabic amounts arrive formatted as "1,000 ج.م."; the abbreviation's
  // full stop also ends the first sentence.
  minimumOrder: (minimum: string, remaining: string) =>
    `الحد الأدنى للطلب هو ${minimum} أضف منتجات بقيمة ${remaining} أخرى للمتابعة إلى إتمام الطلب.`,
  mobileBar: {
    total: "الإجمالي",
    checkout: "إتمام الطلب",
  },
} satisfies Messages["cart"]
