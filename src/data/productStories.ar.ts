import type { ProductStory } from "@/types/catalog"
import type { productStories } from "./productStories"

/*
 * TEMPORARY CONTENT — Arabic version of the placeholder product-page copy in
 * productStories.ts (same products, same notes). Replace both with the
 * localised descriptions and note pyramids from the product API.
 *
 * As in English, each composition keeps the product's two key notes, written
 * with the same Arabic names as the catalogue glossary (i18n/ar/catalog.ts),
 * and nothing here describes a real third-party fragrance.
 */
export const productStoriesAr: Record<keyof typeof productStories, ProductStory> =
  {
    "velvet-iris": {
      description:
        "سوسنٌ بودري يليّنه المسك الأبيض، هادئ وقريب من البشرة، صيغ ليمنحك إحساس كمٍّ من الكشمير.",
      composition: {
        top: ["برغموت", "فلفل وردي"],
        heart: ["سوسن", "ورق البنفسج"],
        base: ["مسك أبيض", "خشب الكشمير"],
      },
      character: ["بودري", "ناعم", "حميم"],
    },
    "nocturne-rose": {
      description:
        "وردةٌ داكنة تتفتّح ببطء بعد الغسق، تُدفئ بتلاتِها نفحةٌ عنبرية راتنجية.",
      composition: {
        top: ["كشمش أسود", "زعفران"],
        heart: ["ورد", "جيرانيوم"],
        base: ["عنبر", "باتشولي"],
      },
      character: ["عميق", "رومانسي", "مسائي"],
    },
    "santal-lumiere": {
      description:
        "خشب صندل كريمي يضيئه التين الأخضر من الداخل؛ تركيبة خشبية بدفء مشمس وانسيابي.",
      composition: {
        top: ["ورق التين", "هيل"],
        heart: ["تين", "جذر السوسن"],
        base: ["خشب الصندل", "مسك"],
      },
      character: ["كريمي", "مضيء", "مسترخٍ"],
    },
    "quiet-oud": {
      description:
        "عودٌ يُقدَّم بتحفّظ، يحيط به أرزٌ جاف في تركيبة مدخّنة تتحدث بهدوء.",
      composition: {
        top: ["إليمي", "فلفل أسود"],
        heart: ["عود", "جلد"],
        base: ["أرز", "فيتيفر"],
      },
      character: ["مدخّن", "متّزن", "راتنجي"],
    },
    "amber-reverie": {
      description:
        "عنبرٌ ذهبي ملفوف بالتونكا، حلو ودافئ، صُنع للأمسيات الهادئة والأحاديث الطويلة.",
      composition: {
        top: ["يوسفي", "قرنفل"],
        heart: ["عنبر", "لادن"],
        base: ["تونكا", "جاوي"],
      },
      character: ["دافئ", "محتضِن", "ذهبي"],
    },
    "fleur-de-peau": {
      description:
        "نيرولي مشرق يستقرّ على جلد سويدي ناعم: عطر زهري يشبه بشرةً دفّأتها الشمس.",
      composition: {
        top: ["نيرولي", "بتيجرين"],
        heart: ["زهر البرتقال", "ياسمين"],
        base: ["جلد السويد", "حبّ المسك"],
      },
      character: ["مشرق", "رقيق", "مصقول"],
    },
    "cedar-veil": {
      description:
        "برغموت منعش فوق أرزٍ يذكّر ببرادة أقلام الرصاص، نظيف وشامخ، مع لمسة عطرية منعشة.",
      composition: {
        top: ["برغموت", "قشر الليمون"],
        heart: ["خزامى", "عرعر"],
        base: ["أرز", "طحلب السنديان"],
      },
      character: ["منعش", "نظيف", "عطري"],
    },
    "eau-de-minuit": {
      description:
        "بخورٌ يتهادى عبر الفانيليا عند منتصف الليل: عنبرٌ تأمّلي بحلاوة مدخّنة هادئة.",
      composition: {
        top: ["فلفل وردي", "إليمي"],
        heart: ["بخور", "مُر"],
        base: ["فانيليا", "خشب الغاياك"],
      },
      character: ["غامض", "مدخّن", "حلو"],
    },
  }
