import type { Messages } from "../messages"

export default {
  intro: {
    eyebrow: "عطور محفوظة",
    title: "المفضلة",
    lead: "العطور التي حفظتها لتعود إليها. تُحفظ قائمتك المفضلة على هذا الجهاز.",
  },
  empty: {
    title: "قائمتك المفضلة فارغة.",
    text: "انقر على رمز القلب في أي عطر لحفظه هنا.",
    action: "اكتشف العطور",
  },
  saved: (name: string) => `تمت إضافة ${name} إلى المفضلة`,
  removed: (name: string) => `تمت إزالة ${name} من المفضلة`,
} satisfies Messages["wishlist"]
