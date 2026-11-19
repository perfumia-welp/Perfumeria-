/*
 * The store's public contact settings: the one place they are defined.
 *
 * Sources, in order of authority:
 *  - Phone / WhatsApp: the merchant's Welp business record (the owner edits
 *    it in Welp; `data.whatsapp`, else `data.phone_number`), read by the
 *    server (server/siteContact.mjs) and served as GET /api/site-contact.
 *  - Email, stores and the map link: this file. Welp has no field for the
 *    email, and its `branches`, `street` and social fields are empty for this
 *    business, so these are the server's configuration until Welp holds them.
 *
 * SITE_CONTACT_DEFAULTS is also the fallback when Welp (or the API) cannot be
 * read, so the page never loses its details. config/company.ts takes the
 * email and WhatsApp number from here, so the values exist once.
 */

export const SITE_CONTACT_DEFAULTS = Object.freeze({
  /** Public mailbox (Titan). Official address since 2026-10-22. */
  email: "info@perfumira.net",
  /** International format; confirmed by the store owner 2026-10-08 (same as Welp). */
  whatsapp: "+201278166686",
  stores: Object.freeze([
    Object.freeze({
      id: "alexandria",
      name: { en: "Alexandria — Sidi Bishr", ar: "الإسكندرية — سيدي بشر" },
      address: {
        en: "Intersection of Gamal Abdel Nasser Street and Mohamed Naguib Street",
        ar: "تقاطع شارع جمال عبد الناصر وشارع محمد نجيب",
      },
      /** Owner-supplied link; its listing confirms the Alexandria intersection. */
      mapUrl: "https://maps.app.goo.gl/pZWhBrwiY1WytfeHA?g_st=awb",
    }),
    Object.freeze({
      id: "cairo",
      name: { en: "Cairo — Heliopolis", ar: "القاهرة — مصر الجديدة" },
      address: { en: "", ar: "" },
      mapUrl: "",
    }),
    Object.freeze({
      id: "mansoura",
      name: { en: "Mansoura — Stadium Street", ar: "المنصورة — شارع الاستاد" },
      address: { en: "", ar: "" },
      mapUrl: "",
    }),
  ]),
})

/**
 * An Egyptian mobile number as "+20XXXXXXXXXX", from "+20 127…", "0127…",
 * "00201…" or similar; null when it is not one (never guessed).
 */
export function normalizeEgyptMobile(raw) {
  if (typeof raw !== "string") return null
  const digits = raw.replace(/[\s()-]/g, "")
  const national = /^(?:\+20|0020|20)?0?(1[0125]\d{8})$/.exec(digits)
  return national ? `+20${national[1]}` : null
}

/** "+201278166686" -> "+20 127 816 6686", the way the site shows it. */
export const formatPhoneDisplay = (number) =>
  number.replace(/^\+20(\d{3})(\d{3})(\d{4})$/, "+20 $1 $2 $3")

/** "tel:" link for a "+20…" number. */
export const phoneHref = (number) => `tel:+${number.replace(/\D/g, "")}`

/**
 * The public contact payload from a Welp business record (`data`), or from
 * the defaults alone when `record` is null. The number comes from Welp only
 * when it is a valid mobile number; anything else keeps the default.
 */
export function buildSiteContact(record, defaults = SITE_CONTACT_DEFAULTS) {
  const fromWelp =
    record && (normalizeEgyptMobile(record.whatsapp) ?? normalizeEgyptMobile(record.phone_number))
  const whatsapp = fromWelp ?? defaults.whatsapp
  return {
    email: defaults.email,
    whatsapp,
    phoneDisplay: formatPhoneDisplay(whatsapp),
    phoneHref: phoneHref(whatsapp),
    stores: defaults.stores.map((store) => ({
      id: store.id,
      name: { ...store.name },
      address: { ...store.address },
      mapUrl: store.mapUrl,
    })),
    source: { phone: fromWelp ? "welp" : "default", email: "config", stores: "config" },
  }
}

/**
 * Checks a payload from GET /api/site-contact before the page uses it; null
 * when anything is missing or malformed (the caller keeps the defaults).
 */
export function parseSiteContact(body) {
  if (!body || typeof body !== "object") return null
  const { email, whatsapp, stores } = body
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  const number = normalizeEgyptMobile(whatsapp)
  if (!number || !Array.isArray(stores)) return null
  const text = (value) => (value && typeof value.en === "string" && typeof value.ar === "string" ? { en: value.en, ar: value.ar } : null)
  const parsed = []
  for (const store of stores) {
    const name = text(store?.name)
    const address = text(store?.address)
    if (typeof store?.id !== "string" || !name || !address) return null
    const mapUrl = typeof store.mapUrl === "string" && /^https:\/\//.test(store.mapUrl) ? store.mapUrl : ""
    parsed.push({ id: store.id, name, address, mapUrl })
  }
  return { email, whatsapp: number, phoneDisplay: formatPhoneDisplay(number), phoneHref: phoneHref(number), stores: parsed }
}
