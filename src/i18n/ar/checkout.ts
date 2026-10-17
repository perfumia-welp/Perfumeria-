import type { Messages } from "../messages"

/*
 * Bidi controls for the plain-text order message: each line starts right to
 * left (RLM), and technical values are isolated left to right (LRI … PDI),
 * so email apps and WhatsApp keep "+20 …", addresses and prices in order.
 */
const RLM = String.fromCharCode(0x200f)
const LRI = String.fromCharCode(0x2066)
const PDI = String.fromCharCode(0x2069)
const ltr = (value: string) => `${LRI}${value}${PDI}`

export default {
  intro: {
    eyebrow: "إتمام الطلب",
    title: "طلب الشراء",
    lead: "اترك بياناتك وسنتواصل معك شخصيًا لتأكيد التوفر والتوصيل والمبلغ النهائي. لا يتم الدفع عبر الإنترنت.",
  },
  backToBag: "العودة إلى الحقيبة",
  detailsLabel: "بياناتك",
  legends: {
    details: "بياناتك",
    delivery: "التوصيل",
  },
  fields: {
    fullName: "الاسم الكامل",
    phone: "رقم الهاتف",
    email: "البريد الإلكتروني",
    address: "عنوان التوصيل",
    cityArea: "المدينة / المنطقة",
    notes: "ملاحظات الطلب",
  },
  submit: "إرسال طلب الشراء",
  submitting: "جارٍ تجهيز الطلب",
  fineprint: (whatsapp: boolean) =>
    `لا يتم الدفع عبر الإنترنت. بعد الإرسال، يمكنك إرسال الطلب إلينا ${
      whatsapp ? "عبر واتساب" : "عبر البريد الإلكتروني"
    } وسنتواصل معك لتأكيده.`,
  summary: {
    title: "ملخص الطلب",
    quantity: "الكمية ",
    lineTotal: "إجمالي المنتج ",
    subtotal: "المجموع الفرعي",
    shipping: "الشحن",
    tax: "الضريبة",
    confirmedByStore: "يؤكّده المتجر",
    giftMessage: "رسالة الإهداء",
    giftNoMessage: "طلب هدية من دون رسالة",
    promoCode: "رمز الخصم",
    promoNotApplied: "أُدخل — لا يُطبَّق تلقائيًا",
    total: "الإجمالي",
    fineprint: "يؤكّد المتجر تكلفة الشحن والضريبة قبل اعتماد طلبك نهائيًا.",
    editBag: "تعديل الحقيبة",
  },
  confirmation: {
    reference: "رقم المرجع",
    referenceHint: "اذكره في أي رسالة تخص هذا الطلب.",
    heading: "تم تجهيز طلب الشراء",
    lead: {
      emailed:
        "أُرسل طلبك إلى فريقنا، وسنتواصل معك لتأكيد التوفر والتوصيل والمبلغ النهائي.",
      whatsapp:
        "أرسله إلينا عبر واتساب لإكمال طلبك، وسنرد عليك لتأكيد التوفر والتوصيل والمبلغ النهائي.",
      mailto:
        "لم يُرسَل طلبك بعد. أرسله إلينا بالبريد الإلكتروني لإكماله، وسنرد عليك لتأكيد التوفر والتوصيل والمبلغ النهائي.",
      sending: "جارٍ إرسال طلبك إلى فريقنا…",
      failed:
        "تعذّر إرسال طلبك تلقائيًا. يُرجى التواصل معنا مع ذكر رقم المرجع لإتمام هذا الطلب.",
    },
    emailLabel: "البريد الإلكتروني",
    email: {
      sending: "جارٍ إرسال طلبك إلى فريقنا…",
      sent: "أُرسل طلبك بالبريد الإلكتروني إلى فريقنا.",
      mailto: (failed: boolean, address: string) =>
        `${
          failed
            ? "تعذّر إرسال طلبك بالبريد الإلكتروني تلقائيًا."
            : "الإرسال التلقائي بالبريد الإلكتروني غير مُفعّل بعد."
        } استخدم «أرسل طلبك بالبريد» لفتح تطبيق البريد لديك موجّهًا إلى ${address}، ثم اضغط «إرسال».`,
      failed: "تعذّر إرسال طلبك بالبريد الإلكتروني.",
    },
    whatsappLabel: "واتساب",
    whatsapp: {
      ready: "يُفتح وفيه تفاصيل طلبك مكتوبة. اضغط «إرسال» في واتساب ليصلنا.",
      unavailableBefore: "الطلب عبر واتساب غير متاح بعد. يمكنك أيضًا ",
      unavailableLink: "التواصل معنا",
      unavailableAfter: " مع ذكر رقم المرجع.",
    },
    openWhatsApp: "فتح واتساب",
    newTab: " (يُفتح في علامة تبويب جديدة)",
    emailRequest: "أرسل طلبك بالبريد",
    editDetails: "تعديل البيانات",
    keptNote: "نحتفظ بحقيبتك حتى تنتهي، تحسّبًا لحاجتك إلى إرسال الطلب مرة أخرى.",
    done: "تم — إفراغ الحقيبة",
  },
  orderMessage: {
    ltr,
    line: (text: string) => `${RLM}${text}`,
    subject: (reference: string) => `طلب شراء ${ltr(reference)}`,
    title: (reference: string) => `طلب شراء جديد ${ltr(reference)}`,
    customer: "بيانات العميل",
    name: "الاسم",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    delivery: "التوصيل",
    address: "العنوان",
    cityArea: "المدينة / المنطقة",
    order: "الطلب",
    item: (index: number, name: string, size: string | null) =>
      `${index}) ${ltr(name)}${
        size ? ` — ${size.replace(/ ?ml$/, " مل")}` : ""
      }`,
    quantity: (quantity: number, unitPrice: string, lineTotal: string) =>
      `   الكمية: ${ltr(`${quantity} × ${unitPrice} = ${lineTotal}`)}`,
    subtotal: "المجموع الفرعي",
    shipping: "الشحن",
    tax: "الضريبة",
    confirmedByStore: "يؤكّده المتجر",
    displayedTotal: "الإجمالي المعروض",
    giftMessage: (message: string) => `رسالة الإهداء: «${message}»`,
    giftNoMessage: "هدية: نعم (من دون رسالة)",
    promo: (code: string) => `رمز الخصم: ${ltr(code)} (أُدخل — لا يُطبَّق تلقائيًا)`,
    notes: (notes: string) => `ملاحظات: ${notes}`,
    closing: "يُرجى تأكيد التوفر والتوصيل والمبلغ النهائي.",
  },
} satisfies Messages["checkout"]
