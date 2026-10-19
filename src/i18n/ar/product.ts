import type { Messages } from "../messages"

export default {
  addToBag: "أضف إلى الحقيبة",
  addToBagShort: "أضف إلى الحقيبة",
  addToBagLabel: (name: string) => `أضف ${name} إلى الحقيبة`,
  chooseOptions: "اختر الخيارات",
  chooseOptionsShort: "اختر الخيارات",
  chooseOptionsLabel: (name: string) => `اختر خيارات ${name}`,
  added: "تمت الإضافة",
  inStock: "متوفر",
  outOfStock: "غير متوفر",
  loading: "جارٍ تحميل العطر…",
  options: {
    loading: "جارٍ تحميل الخيارات…",
    error: "تعذر تحميل الخيارات.",
    retry: "حاول مرة أخرى",
    required: "اختر أحد الخيارات لإضافة المنتج إلى الحقيبة.",
  },
  wishlist: {
    save: "أضف إلى المفضلة",
    remove: "أزل من المفضلة",
    saveVisible: "أضف إلى المفضلة",
    removeVisible: "أزل من المفضلة",
    label: (action: string, name: string) => `${action}، ${name}`,
  },
  gallery: {
    label: "صور المنتج",
    bottle: "الزجاجة",
    photograph: "صورة فوتوغرافية",
    show: (index: number, total: number, view: string) =>
      `عرض الصورة ${index} من ${total}: ${view}`,
  },
  breadcrumb: "مسار التنقّل",
  breadcrumbRoot: "العطور",
  size: "الحجم",
  quantity: "الكمية",
  soldOut: "غير متوفر حاليًا. احفظه في المفضلة لتعود إليه لاحقًا.",
  service:
    "لا يتم الدفع عبر الإنترنت. يتواصل فريقنا معك شخصيًا لتأكيد التوفر والتوصيل والمبلغ النهائي.",
  sections: {
    fragrance: "العطر",
    composition: "التركيبة",
    character: "الطابع",
    details: "التفاصيل",
  },
  composition: {
    top: "النفحات العليا",
    heart: "نفحات القلب",
    base: "نفحات القاعدة",
  },
  dossier: {
    notes: "النوتات",
    closeNotes: "إغلاق النوتات",
    viewFragrance: "عرض العطر",
    price: "السعر",
  },
  details: {
    family: "العائلة العطرية",
    for: "الفئة",
    size: "الحجم",
    keyNotes: "النفحات الرئيسية",
    availability: "التوفر",
    inStock: "متوفر",
    outOfStock: "غير متوفر",
  },
  related: {
    eyebrow: "واصل الاكتشاف",
    title: "قد يعجبك أيضًا",
  },
} satisfies Messages["product"]
