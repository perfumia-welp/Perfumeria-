/*
 * Conservative size reader for company free text. The company has no size
 * field; sizes appear only inside names and descriptions ("100ml", "75 ML").
 *
 * It returns a size only when the text is unambiguous:
 * - only millilitre values written as digits + "ml" (any case, optional space)
 * - exactly one distinct value across name and description
 * - not a set, collection or multi-bottle box (those list several bottles)
 * Anything else returns undefined. The company text itself is never changed.
 */
// Not preceded by a digit or by "digit." (rejects "1.5ml"); "Musk.100ml" is fine.
const ML = /(?<!\d[.,]?)(\d{1,4})\s?ml(?![a-z])/gi
const SET_NAME = /\b(set|collection|coffret|miniatures?|bundle|duo|trio)\b/i
const MULTI_BOTTLE = /\d\s*[x×]\s*\d+\s?ml/i

export function parseSizeMl(name: string, description = ""): number | undefined {
  const text = `${name}\n${description}`
  if (SET_NAME.test(name) || MULTI_BOTTLE.test(text)) return undefined
  const values = new Set([...text.matchAll(ML)].map((match) => Number(match[1])))
  if (values.size !== 1) return undefined
  const [value] = values
  return value >= 1 && value <= 1000 ? value : undefined
}
