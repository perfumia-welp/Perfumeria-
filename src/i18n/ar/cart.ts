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
    estimatedTax: "الضريبة التقديرية",
    calculatedAtCheckout: "تُحتسب عند إتمام الطلب",
    promoToggle: "هل لديك رمز خصم؟",
    promoLabel: "رمز الخصم",
    promoPlaceholder: "رمز الخصم",
    apply: "تطبيق",
    promoEmpty: "يُرجى إدخال رمز الخصم.",
    promoUnavailable: "لا يمكن تطبيق رموز الخصم بعد، ولم يتغيّر إجمالي طلبك.",
    total: "الإجمالي",
    fineprint: "يُحتسب الشحن والضريبة عند إتمام الطلب.",
    proceed: "المتابعة لإتمام الطلب",
  },
  mobileBar: {
    total: "الإجمالي",
    checkout: "إتمام الطلب",
  },
} satisfies Messages["cart"]
