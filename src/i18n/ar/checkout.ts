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
    details: "بيانات التواصل",
    delivery: "عنوان التوصيل",
  },
  requiredNote: "الحقول المُشار إليها بعلامة * مطلوبة.",
  fields: {
    fullName: "الاسم الكامل",
    phone: "رقم الهاتف",
    email: "البريد الإلكتروني",
    address: "العنوان بالتفصيل",
    cityArea: "المدينة / المنطقة",
    notes: "ملاحظات الطلب",
  },
  /*
   * Phone and email are typed left to right, so their examples carry no
   * Arabic prefix: a mixed-direction placeholder would read out of order.
   */
  placeholders: {
    fullName: "مثال: نور حسن",
    phone: "01X XXXX XXXX",
    email: "name@example.com",
    address: "رقم العمارة، الشارع، الدور، الشقة",
    cityArea: "مثال: مدينة نصر، القاهرة",
    notes: "مثال: علامة مميزة قريبة أو أنسب وقت للتوصيل",
  },
  invalid: "بعض البيانات تحتاج إلى مراجعة. اطّلع على الرسالة أسفل كل حقل.",
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
  edit: {
    noChanges:
      "لا توجد تغييرات بعد. عدّل بياناتك هنا أو محتويات حقيبتك، وستظهر خيارات الحفظ.",
    backToOrder: "العودة إلى طلبك",
    itemsLegend: "منتجاتك",
    remove: "إزالة",
    removeLabel: (name: string) => `إزالة ${name} من هذا الطلب`,
    lastItem: "يجب أن يحتوي الطلب على منتج واحد على الأقل.",
    addProduct: "إضافة منتج",
    closeAdd: "إغلاق",
    searchLabel: "ابحث في المجموعة",
    searchPlaceholder: "ابحث بالاسم أو العلامة التجارية",
    searchHint: "اكتب حرفين على الأقل للبحث.",
    noResults: "لا توجد منتجات تطابق بحثك.",
    addToOrder: "أضف إلى الطلب",
    backToResults: "العودة إلى النتائج",
    added: (name: string) => `أُضيف إلى هذا الطلب: ${name}.`,
    extrasLegend: "الهدية ورمز الخصم",
    promoHint: "يُسجَّل ليراجعه فريقنا، ولا يُطبَّق تلقائيًا.",
    belowMinimum: (minimum: string, remaining: string) =>
      `الحد الأدنى للطلب هو ${minimum}. أضف ${remaining} أخرى لحفظ هذه التغييرات.`,
    blocked: (count: number) =>
      count === 1
        ? "لحفظ تغييراتك، صحّح هذا الحقل أولًا:"
        : "لحفظ تغييراتك، صحّح هذه الحقول أولًا:",
    saveAndSend: "حفظ وإرسال الطلب المعدّل",
    save: "حفظ التغييرات",
    saveHint:
      "«حفظ التغييرات» يحفظ تعديلاتك دون إبلاغ فريقنا الآن، ويمكنك إرسالها لاحقًا.",
  },
  confirmation: {
    reference: "رقم المرجع",
    referenceHint: "اذكره في أي رسالة تخص هذا الطلب.",
    heading: "تم استلام طلب الشراء",
    updatedHeading: "تم تحديث طلب الشراء",
    savedHeading: "تم حفظ التغييرات",
    sendUpdated: "إرسال الطلب المعدّل",
    lead: {
      emailed:
        "شكرًا لك، طلبك وصل إلى فريقنا بالفعل. سنتواصل معك قريبًا لتأكيد التوفر والتوصيل والمبلغ النهائي، ولا تحتاج إلى فعل أي شيء آخر.",
      updated:
        "شكرًا لك، طلبك المعدّل وصل إلى فريقنا بالفعل. سنتواصل معك قريبًا لتأكيد التوفر والتوصيل والمبلغ النهائي، ولا تحتاج إلى فعل أي شيء آخر.",
      saved:
        "حُفظت تغييراتك على هذا الطلب لكنها لم تُرسل إلى فريقنا بعد. أرسلها متى كنت مستعدًا لنحدّث طلبك.",
      unchanged:
        "طلبك محدّث: لدى فريقنا هذه النسخة بالفعل، لذلك لم يُرسل أي جديد.",
      whatsapp:
        "حُفظ طلبك، لكن فريقنا لم يُبلَّغ به بعد. يُرجى إرساله إلينا عبر واتساب لنراه فورًا، وسنرد عليك لتأكيد التوفر والتوصيل والمبلغ النهائي.",
      mailto:
        "حُفظ طلبك، لكنه لم يصل إلى فريقنا بالبريد الإلكتروني بعد. أرسله إلينا بالبريد، وسنرد عليك لتأكيد التوفر والتوصيل والمبلغ النهائي.",
      sending: "جارٍ إرسال طلبك إلى فريقنا…",
      failed:
        "حُفظ طلبك، لكن تعذّر إبلاغ فريقنا. يُرجى التواصل معنا مع ذكر رقم المرجع.",
    },
    emailLabel: "البريد الإلكتروني",
    email: {
      sending: "جارٍ إرسال طلبك إلى فريقنا…",
      sent: "تم الإرسال. طلبك لدى فريقنا.",
      notSent: "لم يُرسل إلى فريقنا بعد.",
      unchanged: "لدى فريقنا هذه النسخة بالفعل.",
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
      optional: "اختياري: للحصول على رد أسرع، افتح واتساب واضغط «إرسال». طلبك محفوظ بالفعل.",
      ready:
        "«فتح واتساب» يبدأ محادثة معنا وطلبك مكتوب فيها جاهزًا. اضغط «إرسال» ليصل إلى فريقنا.",
      unavailableBefore: "الطلب عبر واتساب غير متاح بعد. يمكنك أيضًا ",
      unavailableLink: "التواصل معنا",
      unavailableAfter: " مع ذكر رقم المرجع.",
    },
    openWhatsApp: "فتح واتساب",
    newTab: " (يُفتح في علامة تبويب جديدة)",
    emailRequest: "أرسل طلبك بالبريد",
    editDetails: "تعديل البيانات",
    continueShopping: "متابعة التسوق",
  },
  orderPage: {
    loading: "جارٍ تحميل طلبك…",
    missingTitle: "تعذّر فتح هذا الطلب",
    missing:
      "هذا الطلب غير متاح في هذا المتصفح. إذا أرسلته وأنت مسجّل الدخول، فسجّل الدخول أولًا. ويمكنك أيضًا التواصل معنا مع ذكر رقم المرجع.",
    failed: "تعذّر تحميل طلبك الآن. يُرجى المحاولة مرة أخرى بعد قليل.",
    retry: "إعادة المحاولة",
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
      `   عرض اشترِ 3 واحصل على الرابع مجانًا: ${free} مجانًا (${ltr(`−${discount}`)})`,
    subtotal: "المجموع الفرعي",
    promotion: "اشترِ 3 واحصل على الرابع مجانًا",
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
