import type { Messages } from "../messages"

export default {
  hero: {
    eyebrow: "المجموعة المميّزة",
    heading: {
      lines: ["بصمةٌ عطرية", "لكل لحظة"],
      emphasis: "لحظة",
    },
    cta: "اكتشف المجموعة",
    slides: {
      floral: {
        mood: "زهري / ناعم",
        notes: ["سوسن", "فاوانيا", "مسك أبيض"],
        description:
          "اكتشف مجموعة حصرية من العطور الفاخرة، صُمّمت لتعبّر عن الأناقة والثقة والتفرّد.",
        imageAlt: "زجاجة عطر بجوار أزهار رقيقة في ضوء دافئ",
      },
      amber: {
        mood: "دافئ / عنبري",
        notes: ["عنبر", "فانيليا", "جاوي"],
        description:
          "عنبرٌ ذهبي وفانيليا ناعمة وراتنجات دافئة، تتوهّج على البشرة من آخر النهار حتى المساء.",
        imageAlt: "زجاجة عطر عنبرية في ضوء دافئ على حرير عاجي",
      },
      oud: {
        mood: "عود / ليل",
        notes: ["عود", "أرز مدخّن", "جلد"],
        description:
          "عودٌ عميق وأخشاب مدخّنة وجلد ناعم: أثرٌ آسر وحميم صُنع لساعات ما بعد الغروب.",
        imageAlt: "زجاجة عطر سوداء تحيط بها أزهار حمراء داكنة",
      },
    },
  },
  carousel: {
    controls: "أدوات التحكم في العرض",
    previous: "الشريحة السابقة",
    next: "الشريحة التالية",
    play: "تشغيل العرض",
    pause: "إيقاف العرض مؤقتًا",
    slide: (index: number, total: number, mood: string) =>
      `${index} من ${total}: ${mood}`,
    announcement: (index: number, total: number, mood: string) =>
      `الشريحة ${index} من ${total}: ${mood}`,
  },
  offers: {
    eyebrow: "مختارات الموسم",
    title: "عروض هذا الموسم",
    cta: "عرض الكل",
  },
  specialOffer: {
    eyebrow: "عرض خاص",
    heading: { lines: ["لمسةٌ صغيرة", "مميّزة"], emphasis: "مميّزة" },
    description:
      "دعوةٌ لاكتشاف بصمتك العطرية الجديدة. استمتع بخصم 20% على تركيبة مختارة، حصريًا لمجتمع عشّاق العطور لدينا.",
    discountLabel: "خصم 20%",
    codeLabel: "استخدم الرمز",
    cta: "تسوّق العرض",
    imageAlt: "زجاجة عطر تحت ضوء مسلّط على مسرح داكن، يتطاير حولها غبار ذهبي",
    imageCaption: "تركيبات مختارة",
  },
  categories: {
    eyebrow: "اعثر على ما يعبّر عنك",
    title: "تسوّق حسب الفئة",
    support: {
      eyebrow: "اكتشف عطرك",
      title: "عطرٌ لكل تعبير.",
      description: "اكتشف عطورًا صيغت لكل شخصية، ولكل مزاج، ولكل لحظة.",
      cta: "اكتشف جميع العطور",
    },
    label: "مجموعة",
    cta: "اكتشف",
    items: {
      women: { name: "نسائية", imageAlt: "مجموعة العطور النسائية" },
      men: { name: "رجالية", imageAlt: "مجموعة العطور الرجالية" },
      unisex: { name: "للجنسين", imageAlt: "مجموعة العطور للجنسين" },
    },
  },
  instagram: {
    title: "تابعونا على Instagram",
    description:
      "اكتشفوا أحدث الإصدارات وحكايات العطور ولمحاتٍ من كواليس Perfumeria.",
    cta: "زوروا حسابنا على Instagram",
    view: "شاهدوا على Instagram",
    posts: {
      arrivals: {
        label: "أحدث الإصدارات",
        imageAlt: "زجاجة عطر عنبرية في ضوء دافئ بجوار حرير عاجي",
      },
      stories: {
        label: "حكايات العطور",
        imageAlt: "زجاجة عطر مستديرة على الحرير مع أزهار مجففة وخواتم",
      },
      backstage: {
        label: "من الكواليس",
        imageAlt: "زجاجة عطر سوداء أمام أزهار حمراء داكنة",
      },
    },
  },
  testimonials: {
    eyebrow: "من مجتمعنا",
    title: "عطورٌ لا تُنسى، وحكاياتٌ تُروى.",
    viewport: "آراء العملاء، استخدم مفاتيح الأسهم للتنقّل",
    previous: "الرأي السابق",
    next: "الرأي التالي",
    slide: (index: number, total: number) => `${index} من ${total}`,
    announcement: (index: number, total: number) =>
      `الرأي ${index} من ${total}`,
    rating: (rating: number, max: number) => `${rating} من ${max} نجوم`,
    quoted: (quote: string) => `«${quote}»`,
    items: {
      "amelia-laurent": {
        name: "أميليا لوران",
        role: "عميلة موثّقة",
        quote:
          "جعلت Perfumeria اختيار العطر تجربة شخصية عميقة. عطر Velvet Iris هادئ وواثق، ولا يشبه أي عطر آخر أملكه.",
      },
      "julian-moreau": {
        name: "جوليان مورو",
        role: "عميل موثّق",
        quote:
          "تركيبة جميلة ذات حضور استثنائي، تشعر بالعناية في كل تفاصيلها من النفحة الأولى حتى آخر أثر على البشرة.",
      },
      "elise-martin": {
        name: "إليز مارتان",
        role: "عميلة موثّقة",
        quote:
          "يستقرّ عطر Nocturne Rose في هيئة دافئة وحميمة، وفي كل مرة أُسأل عن العطر الذي أضعه.",
      },
      "theo-bennett": {
        name: "ثيو بينيت",
        role: "عميل موثّق",
        quote:
          "كانت تجربة الاكتشاف مدروسة بقدر العطر نفسه. أصبح Quiet Oud جزءًا من طقوس كل مساء.",
      },
      "sofia-rossi": {
        name: "صوفيا روسي",
        role: "عميلة موثّقة",
        quote:
          "أنيق من دون أن يكون متوقَّعًا. يتألّق Santal Lumière على البشرة ويترك أثرًا ناعمًا لا يُنسى.",
      },
    },
  },
} satisfies Messages["home"]
