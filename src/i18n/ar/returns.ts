import type { Messages } from "../messages"

/*
 * Owner-approved policy (supplied 2026-10-17) — the authoritative text. Only
 * spelling and punctuation were corrected (ة/ه, على, hamzat al-wasl, commas);
 * the amount uses the site's Latin digits. Do not add or change conditions.
 */
const returns: Messages["returns"] = {
  intro: {
    eyebrow: "خدمة العملاء",
    title: "الاستبدال والاسترجاع",
    lead: "تنطبق الشروط التالية على طلبات الاستبدال والاسترجاع للطلبات الأونلاين.",
  },
  policyTitle: "سياسة الاستبدال والاسترجاع للطلبات الأونلاين",
  translationNote: "",
  fee: "140 جنيه",
  terms: [
    "يُقبل طلب الاستبدال أو الاسترجاع يوم الاستلام من المندوب أو اليوم التالي فقط، مع توضيح المشكلة بالصور.",
    "يجب إرجاع المنتج بنفس الحالة التي تم استلامه بها.",
    "يتحمل العميل تكلفة شحن المنتج لأحد مكاتب برفيوميرا المحددة من قِبل الشركة.",
    "في حالة فتح علبة المنتج أو بلاستيك تغليف المصنع، يتم فرض رسوم 140 جنيه.",
    "يجب على العميل التأكد من أن بيانات العنوان والتليفون وأي ملاحظات هامة للمندوب صحيحة، وعدم صعوبة التواصل مع المندوب عند التسليم.",
  ],
  termsLabel: "شروط السياسة",
  help: {
    title: "تحتاج إلى مساعدة في الاستبدال أو الاسترجاع؟",
    text: "فريق خدمة العملاء جاهز لمساعدتك في طلب الاستبدال أو الاسترجاع لطلبك الأونلاين.",
    contact: "تواصل معنا",
    faq: "الأسئلة الشائعة",
  },
}

export default returns
