import type { Messages } from "../messages"
import { fragrances } from "./plural"

export default {
  label: "البحث في Perfumira",
  close: "إغلاق البحث",
  inputLabel: "ابحث عن العطور والنفحات",
  placeholder: "ابحث عن عطر أو نفحة…",
  submit: "عرض جميع النتائج",
  popular: "عمليات البحث الشائعة",
  results: "النتائج",
  found: (count: number) => `النتائج: ${fragrances(count)}`,
  none: "لم نعثر على عطور",
  loading: "جارٍ تحميل المجموعة…",
  viewAll: (term: string) => `عرض جميع نتائج «${term}»`,
  empty: {
    title: "لم نعثر على عطور.",
    text: "جرّب اسم عطر آخر أو نفحة أو عائلة عطرية.",
  },
} satisfies Messages["search"]
