import type { Messages } from "../messages"

/*
 * Arabic titles and descriptions. Interface wording only: product names and
 * descriptions are never translated here. The brand stays in Latin letters.
 */
const authDescription =
  "سجّل الدخول إلى حسابك في Perfumira أو أنشئ حسابًا جديدًا."

export default {
  siteTitle: "Perfumira",
  siteDescription:
    "تسوّق عطور الرجال والنساء أونلاين في مصر من Perfumira، مستورد وموزّع للعطور منذ 1997. الأسعار بالجنيه المصري.",
  pages: {
    home: {
      title: "تسوّق العطور أونلاين في مصر",
      documentTitle: "Perfumira | تسوّق العطور أونلاين في مصر",
      description:
        "تسوّق عطور الرجال والنساء أونلاين في مصر من Perfumira، مستورد وموزّع للعطور منذ 1997. الأسعار بالجنيه المصري.",
    },
    products: {
      title: "كل العطور",
      documentTitle: "كل العطور: عطور رجالية ونسائية | Perfumira",
      description:
        "تصفّح مجموعة عطور Perfumira الكاملة للرجال والنساء، مع الأسعار بالجنيه المصري وحالة التوفر لكل عطر.",
    },
    menPerfumes: {
      title: "عطور رجالية",
      documentTitle: "عطور رجالية في مصر | Perfumira",
      description:
        "تسوّق العطور الرجالية أونلاين من Perfumira. تصفّح كل العطور الرجالية في المجموعة مع الأسعار بالجنيه المصري.",
    },
    womenPerfumes: {
      title: "عطور نسائية",
      documentTitle: "عطور نسائية في مصر | Perfumira",
      description:
        "تسوّق العطور النسائية أونلاين من Perfumira. تصفّح كل العطور النسائية في المجموعة مع الأسعار بالجنيه المصري.",
    },
    about: {
      // /ar/about still shows the earlier About page (no approved Arabic
      // copy yet), so it is noindex (route handle `arabicDraft`).
      title: "من نحن",
      description:
        "قصة Perfumira وطريقتنا في اختيار العطور لتعبّر عن الشخصية والمزاج والذكرى.",
    },
    contact: {
      title: "تواصل معنا",
      documentTitle: "تواصل مع Perfumira | الطلبات واستفسارات الجملة",
      description:
        "تواصل مع Perfumira بخصوص طلب أو عطر أو استفسارات شراء العطور بالجملة في مصر.",
    },
    faq: {
      // English-only page: /ar/faq declares /faq as its canonical, so the
      // owner's English SEO settings are kept rather than a translation.
      title: "Frequently Asked Questions",
      documentTitle: "Perfume FAQs & Wholesale Questions | Perfumira",
      description:
        "Find answers about Perfumira's perfume collection, product quality, ordering, delivery, and wholesale perfume inquiries in Egypt.",
    },
    returns: {
      title: "الاستبدال والاسترجاع",
      documentTitle: "سياسة الاستبدال والاسترجاع | Perfumira مصر",
      description:
        "اطّلع على سياسة Perfumira للاستبدال والاسترجاع للطلبات الأونلاين: موعد تقديم الطلب، وحالة المنتج، وتكلفة شحن الإرجاع، ورسوم فتح العبوة.",
    },
    wishlist: {
      title: "المفضلة",
      description: "العطور التي حفظتها في Perfumira.",
    },
    cart: {
      title: "حقيبة التسوق",
      description: "راجع العطور في حقيبة التسوق الخاصة بك في Perfumira.",
    },
    checkout: {
      title: "إتمام الطلب",
      description:
        "أرسل طلب شراء، ويؤكّد فريق Perfumira معك التوفر والتوصيل والمبلغ النهائي.",
    },
    account: {
      title: "حسابي",
      description: "حسابك في Perfumira: الطلبات والعطور المحفوظة والبيانات.",
    },
    signIn: { title: "تسجيل الدخول", description: authDescription },
    signUp: { title: "إنشاء حساب", description: authDescription },
    forgotPassword: { title: "نسيت كلمة المرور", description: authDescription },
    resetPassword: {
      title: "إعادة تعيين كلمة المرور",
      description: authDescription,
    },
    notFound: {
      title: "الصفحة غير موجودة",
      description: "تعذّر العثور على هذه الصفحة. تابع اكتشاف Perfumira.",
    },
  },
  product: {
    title: (name: string, size?: string, reference?: string) =>
      `${name}${size ? ` ${size}` : ""}${reference ? ` (مرجع ${reference})` : ""} – السعر والتفاصيل | Perfumira`,
    summary: (
      name: string,
      size: string | undefined,
      kind: string,
      price: string,
      inStock: boolean,
    ) =>
      `${name}${size ? ` ${size}` : ""}، ${kind} من Perfumira. ${price}. ${inStock ? "متوفر" : "غير متوفر حاليًا"}.`,
    kinds: {
      men: "عطر رجالي",
      women: "عطر نسائي",
      unisex: "عطر للجنسين",
      other: "عطر",
    },
    price: (amount: string) => `السعر ${amount}`,
    priceFrom: (amount: string) => `ابتداءً من ${amount}`,
  },
  breadcrumb: {
    home: "الرئيسية",
  },
} satisfies Messages["meta"]
