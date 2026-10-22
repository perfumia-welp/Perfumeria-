import type { Messages } from "../messages"

export default {
  description: [
    "اكتشف بصمتك العطرية الجديدة.",
    "عالمٌ من العطور المنتقاة بعناية",
    "لتعبّر عن الشخصية والمزاج والذكرى.",
  ],
  groups: {
    shop: "تسوّق",
    customerCare: "خدمة العملاء",
    about: "من نحن",
  },
  links: {
    allFragrances: "جميع العطور",
    forWomen: "للنساء",
    forMen: "للرجال",
    unisex: "للجنسين",
    wishlist: "المفضلة",
    contact: "تواصل معنا",
    returnsExchanges: "الاستبدال والاسترجاع",
    faqs: "الأسئلة الشائعة",
    trackOrder: "تتبّع الطلب",
    ourStory: "قصتنا",
    ingredients: "المكوّنات",
    fragranceGuide: "دليل العطور",
    stockists: "نقاط البيع",
  },
  social: {
    instagram: "إنستغرام",
    facebook: "فيسبوك",
    tiktok: "تيك توك",
    telegram: "تيليغرام",
    whatsapp: "واتساب",
    newTab: "يُفتح في نافذة جديدة",
  },
  legal: {
    privacy: "الخصوصية",
    terms: "الشروط والأحكام",
  },
  newsletter: {
    title: "النشرة البريدية",
    description: [
      "انضم إلى نشرتنا العطرية،",
      "لتصلك أحدث الإصدارات",
      "والعروض الخاصة والحكايات.",
    ],
    placeholder: "البريد الإلكتروني",
    label: "البريد الإلكتروني",
    submit: "الاشتراك في النشرة البريدية",
    messages: {
      empty: "يُرجى إدخال بريدك الإلكتروني.",
      invalid: "يُرجى إدخال بريد إلكتروني صحيح.",
      submitting: "جارٍ الاشتراك…",
      subscribed: "شكرًا لك، تم الاشتراك في نشرة Perfumira بنجاح.",
      alreadySubscribed: "أنت مشترك بالفعل في نشرة Perfumira.",
      unavailable:
        "الاشتراك في النشرة البريدية غير متاح هنا حاليًا، ولم يُحفظ بريدك الإلكتروني.",
      rateLimited: "محاولات كثيرة. يُرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى.",
      error: "تعذّر حفظ بريدك الإلكتروني. يُرجى المحاولة مرة أخرى.",
    },
  },
  copyright: "© 2026 Perfumira",
} satisfies Messages["footer"]
