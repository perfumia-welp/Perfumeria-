/*
 * Arabic has six plural forms (zero, one, two, few 3–10, many 11–99, other
 * 100+), chosen by Intl.PluralRules. `{n}` in a form is replaced by the count.
 */
const rules = new Intl.PluralRules("ar")

export type PluralForms = Record<Intl.LDMLPluralRule, string>

export const plural = (count: number, forms: PluralForms) =>
  forms[rules.select(count)].replace("{n}", String(count))

/** "عطر واحد", "عطران", "3 عطور", "11 عطرًا", "100 عطر". */
export const fragrances = (count: number) =>
  plural(count, {
    zero: "{n} عطر",
    one: "عطر واحد",
    two: "عطران",
    few: "{n} عطور",
    many: "{n} عطرًا",
    other: "{n} عطر",
  })

/** Bag items: "قطعة واحدة", "قطعتان", "3 قطع", "11 قطعة". */
export const pieces = (count: number) =>
  plural(count, {
    zero: "{n} قطعة",
    one: "قطعة واحدة",
    two: "قطعتان",
    few: "{n} قطع",
    many: "{n} قطعة",
    other: "{n} قطعة",
  })
