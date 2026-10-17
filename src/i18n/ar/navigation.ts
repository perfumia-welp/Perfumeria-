import type { Messages } from "../messages"
import { pieces } from "./plural"

export default {
  skipToContent: "انتقل إلى المحتوى",
  main: "التنقل الرئيسي",
  home: "الرئيسية",
  about: "من نحن",
  products: "المنتجات",
  contact: "تواصل معنا",
  search: "بحث",
  account: "الحساب",
  signIn: "تسجيل الدخول",
  bag: "الحقيبة",
  menu: "القائمة",
  close: "إغلاق",
  language: "اللغة",
  brandHome: (brand: string) => `${brand} – الصفحة الرئيسية`,
  bagLabel: (count: number) =>
    count === 0 ? "الحقيبة، فارغة" : `الحقيبة، ${pieces(count)}`,
} satisfies Messages["navigation"]
