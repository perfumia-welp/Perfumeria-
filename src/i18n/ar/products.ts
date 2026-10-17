import type { Messages } from "../messages"

export default {
  intro: {
    eyebrow: "المجموعة",
    title: "عطورنا",
    lead: "اكتشف تركيبات اخترناها لتعبّر عن الشخصية والمزاج والذكرى.",
  },
  resultsFor: (term: string) => `نتائج البحث عن «${term}»`,
  clearSearch: "مسح البحث",
  toolbar: {
    label: "التصفية والترتيب",
    filterBy: "تصفية حسب",
    selected: "محدّد",
    all: "الكل",
    clearAll: "مسح الكل",
    filter: "تصفية",
    sortBy: "ترتيب حسب",
  },
  groups: {
    gender: "الفئة",
    family: "العائلة العطرية",
    availability: "التوفر",
    price: "السعر",
    brand: "العلامة التجارية",
  },
  mobileFilters: {
    label: "تصفية العطور",
    title: "تصفية",
    show: (count: number) => `عرض النتائج (${count})`,
  },
  empty: {
    title: "لا توجد عطور تطابق اختيارك.",
    text: "جرّب إزالة أحد عوامل التصفية أو البحث عن نفحة أخرى.",
    action: "مسح عوامل التصفية",
  },
  pagination: {
    label: "صفحات المنتجات",
    previous: "السابق",
    next: "التالي",
    page: (page: number) => `الصفحة ${page}`,
    pageOf: (page: number, count: number) => `الصفحة ${page} من ${count}`,
  },
  loading: "جارٍ تحميل المجموعة…",
  loadError: "تعذر تحميل المجموعة كاملة.",
  retry: "حاول مرة أخرى",
} satisfies Messages["products"]
