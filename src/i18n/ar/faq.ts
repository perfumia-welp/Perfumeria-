import type { Messages } from "../messages"

/*
 * FAQ page chrome only. The owner has approved English FAQ copy only, so
 * /ar/faq shows that copy in English (marked lang="en") under this notice
 * until approved Arabic copy exists. Do not machine-translate the answers.
 */
const faq: Messages["faq"] = {
  eyebrow: "خدمة العملاء",
  // 3–10: أسئلة; 11 and above: سؤالًا.
  questionCount: (count: number) =>
    count >= 3 && count <= 10 ? `${count} أسئلة` : `${count} سؤالًا`,
  topicsLabel: "الموضوعات",
  englishOnly: "هذه الصفحة متاحة حاليًا باللغة الإنجليزية فقط.",
}

export default faq
