import { productStoriesAr } from "@/data/productStories.ar"
import type { Messages } from "../messages"

export default {
  families: {
    floral: "زهري",
    woody: "خشبي",
    amber: "عنبري",
  },
  genders: {
    women: "نسائي",
    men: "رجالي",
    unisex: "للجنسين",
  },
  availability: {
    "in-stock": "متوفر",
    "out-of-stock": "غير متوفر",
  },
  priceRanges: {
    under: (max: string) => `أقل من ${max}`,
    between: (min: string, max: string) => `${min} – ${max}`,
    over: (min: string) => `أكثر من ${min}`,
  },
  sort: {
    featured: "المميّزة",
    "price-asc": "السعر: من الأقل إلى الأعلى",
    "price-desc": "السعر: من الأعلى إلى الأقل",
    name: "الاسم: من A إلى Z",
  },
  popularSearches: ["عود", "ورد", "مسك", "فانيليا", "زهري"],
  /*
   * Arabic names for the catalogue's key notes (cards, search, bag). Product
   * names stay in Latin letters; search matches both languages.
   */
  notes: {
    Iris: "سوسن",
    "White Musk": "مسك أبيض",
    Rose: "ورد",
    Amber: "عنبر",
    Sandalwood: "خشب الصندل",
    Fig: "تين",
    Oud: "عود",
    Cedar: "أرز",
    Tonka: "تونكا",
    Neroli: "نيرولي",
    Suede: "جلد السويد",
    Bergamot: "برغموت",
    Incense: "بخور",
    Vanilla: "فانيليا",
  },
  stories: productStoriesAr,
  packshotAlt: (name: string) => `زجاجة عطر ${name}`,
  editorialAlt: (name: string) => `عطر ${name}`,
} satisfies Messages["catalog"]
