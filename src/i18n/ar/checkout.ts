import type { Messages } from "../messages"

/*
 * Bidi controls for the plain-text order message: each line starts right to
 * left (RLM), and technical values are isolated left to right (LRI … PDI),
 * so email apps and WhatsApp keep "+20 …", addresses and prices in order.
 * Product names (English, or an approved Arabic name) take the direction of
 * their first letter (FSI … PDI).
 */
const RLM = String.fromCharCode(0x200f)
const LRI = String.fromCharCode(0x2066)
const FSI = String.fromCharCode(0x2068)
const PDI = String.fromCharCode(0x2069)
const ltr = (value: string) => `${LRI}${value}${PDI}`
const isolate = (value: string) => `${FSI}${value}${PDI}`

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
  submitting: "جارٍ إرسال طلب الشراء",
  fineprint: (whatsapp: boolean) =>
    `لا يتم الدفع عبر الإنترنت. عند الإرسال نحفظ طلبك ونرسله إلى فريقنا${
      whatsapp ? "، ويمكنك أيضًا إرساله إلينا عبر واتساب" : ""
    }. وسنتواصل معك لتأكيده.`,
  quote: {
    title: "الأسعار المحدّثة",
    total: "الإجمالي الجديد",
    confirm: "تأكيد الإجمالي الجديد والطلب",
  },
  errors: {
    priceChanged:
      "تغيّرت الأسعار منذ أضفت هذه المنتجات. راجع الأسعار المحدّثة أدناه، ثم أكّد طلبك.",
    unavailable: (name: string) =>
      `هذا المنتج لم يعد متاحًا: ${isolate(name)}. احذفه من حقيبتك للمتابعة.`,
    unavailableUnnamed:
      "أحد المنتجات في حقيبتك لم يعد متاحًا. احذفه من حقيبتك للمتابعة.",
    invalidItems:
      "أحد المنتجات في حقيبتك لم يعد يطابق الكتالوج. عُد إلى حقيبتك وراجعها ثم حاول مرة أخرى.",
    rateLimited:
      "محاولات طلب كثيرة من هذا الاتصال. يُرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى، أو التواصل معنا.",
    session: "تعذّر بدء جلسة آمنة. يُرجى المحاولة مرة أخرى.",
    sessionExpired: "انتهت صلاحية الجلسة. حدّث الصفحة ثم أرسل طلبك مرة أخرى.",
    locked:
      "لم يعد بالإمكان تعديل هذا الطلب عبر الموقع. يُرجى التواصل معنا مع ذكر رقم المرجع.",
    failed:
      "لم يتم تأكيد طلبك. تحقّق من اتصالك وحاول مرة أخرى، أو تواصل معنا.",
  },
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
    fineprint: "يؤكّد المتجر تكلفة الشحن قبل اعتماد طلبك نهائيًا.",
    editBag: "تعديل الحقيبة",
  },
  confirmation: {
    reference: "رقم المرجع",
    referenceHint: "اذكره في أي رسالة تخص هذا الطلب.",
    heading: "تم استلام طلب الشراء",
    updatedHeading: "تم تحديث طلب الشراء",
    lead: {
      emailed:
        "حُفظ طلبك وأُرسل إلى فريقنا، وسنتواصل معك لتأكيد التوفر والتوصيل والمبلغ النهائي.",
      updated:
        "حُفظت تعديلاتك وأُرسلت إلى فريقنا كتحديث لهذا الطلب، وسنتواصل معك لتأكيد التوفر والتوصيل والمبلغ النهائي.",
      whatsapp:
        "حُفظ طلبك. أرسله إلينا عبر واتساب أيضًا ليراه فريقنا فورًا، وسنرد عليك لتأكيد التوفر والتوصيل والمبلغ النهائي.",
      mailto:
        "حُفظ طلبك، لكنه لم يصل إلى فريقنا بالبريد الإلكتروني بعد. أرسله إلينا بالبريد، وسنرد عليك لتأكيد التوفر والتوصيل والمبلغ النهائي.",
      sending: "جارٍ إرسال طلبك إلى فريقنا…",
      failed:
        "حُفظ طلبك، لكن تعذّر إبلاغ فريقنا. يُرجى التواصل معنا مع ذكر رقم المرجع.",
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
    subject: (reference: string, updated: boolean) =>
      `${updated ? "تحديث طلب شراء" : "طلب شراء"} ${ltr(reference)}`,
    title: (reference: string, updated: boolean) =>
      `${updated ? "تحديث طلب شراء" : "طلب شراء جديد"} ${ltr(reference)}`,
    customer: "بيانات العميل",
    name: "الاسم",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    delivery: "التوصيل",
    address: "العنوان",
    cityArea: "المدينة / المنطقة",
    order: "الطلب",
    item: (index: number, name: string, size: string | null) =>
      `${index}) ${isolate(name)}${
        size ? ` — ${size.replace(/ ?ml$/, " مل")}` : ""
      }`,
    quantity: (quantity: number, unitPrice: string, lineTotal: string) =>
      `   الكمية: ${ltr(`${quantity} × ${unitPrice} = ${lineTotal}`)}`,
    freeUnits: (free: number, discount: string) =>
      `   عرض اشترِ 3: ${free} مجانًا (${ltr(`−${discount}`)})`,
    subtotal: "المجموع الفرعي",
    promotion: "اشترِ 3 واحصل على الأقل سعرًا مجانًا",
    payableSubtotal: "المجموع الفرعي النهائي",
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
