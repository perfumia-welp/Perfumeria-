import type { Messages } from "../messages"

const authDescription =
  "سجّل الدخول إلى حسابك في Perfumeria أو أنشئ حسابًا جديدًا."

export default {
  siteTitle: "Perfumeria",
  siteDescription:
    "اكتشف بصمتك العطرية الجديدة. عالمٌ من العطور المنتقاة بعناية لتعبّر عن الشخصية والمزاج والذكرى.",
  pages: {
    products: {
      title: "عطورنا",
      description:
        "اكتشف مجموعة Perfumeria: عطور زهرية وخشبية وعنبرية للنساء والرجال وللجنسين.",
    },
    about: {
      title: "من نحن",
      description:
        "قصة Perfumeria وطريقتنا في اختيار العطور لتعبّر عن الشخصية والمزاج والذكرى.",
    },
    contact: {
      title: "تواصل معنا",
      description:
        "لديك سؤال عن طلب أو عطر أو أي أمر آخر؟ تواصل مع فريق Perfumeria.",
    },
    wishlist: {
      title: "المفضلة",
      description: "العطور التي حفظتها في Perfumeria.",
    },
    cart: {
      title: "حقيبة التسوق",
      description: "راجع العطور في حقيبة التسوق الخاصة بك في Perfumeria.",
    },
    checkout: {
      title: "إتمام الطلب",
      description:
        "أرسل طلب شراء، ويؤكّد فريق Perfumeria معك التوفر والتوصيل والمبلغ النهائي.",
    },
    account: {
      title: "حسابي",
      description: "حسابك في Perfumeria: الطلبات والعطور المحفوظة والبيانات.",
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
      description: "تعذّر العثور على هذه الصفحة. تابع اكتشاف Perfumeria.",
    },
  },
} satisfies Messages["meta"]
