import type { Messages } from "../messages"

export default {
  label: "خيارات التواصل",
  launcher: {
    title: "هل تحتاج مساعدة؟",
    subtitle: "نحن هنا لمساعدتك",
  },
  heading: "كيف يمكننا مساعدتك؟",
  intro: "يسعدنا أن نرافقك في اختيار عطرك القادم.",
  actions: {
    chat: {
      label: "تحدث معنا",
      hint: "عبر واتساب",
    },
    contact: {
      label: "تواصل معنا",
      hint: "أرسل لنا رسالة",
    },
  },
  follow: "تابع Perfumira",
} satisfies Messages["contactLauncher"]
