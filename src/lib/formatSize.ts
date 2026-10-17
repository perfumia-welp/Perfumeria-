/** "50ml" → "50 ml" / "50 مل": the value is shared, only the unit is translated. */
export const formatSize = (size: string, unit: string) =>
  size.replace(/ml$/, ` ${unit}`)
