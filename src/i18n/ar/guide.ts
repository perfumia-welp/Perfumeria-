import type { Messages } from "../messages"

/*
 * Guide page chrome only. The owner has approved English guide copy only, so
 * /ar/guides/* shows that copy in English (marked lang="en") under this
 * notice until approved Arabic copy exists. Do not machine-translate guides.
 */
const guide: Messages["guide"] = {
  englishOnly: "هذه الصفحة متاحة حاليًا باللغة الإنجليزية فقط.",
}

export default guide
