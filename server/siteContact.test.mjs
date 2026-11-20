// Contact page settings: shared/siteContact.mjs, server/siteContact.mjs and
// GET /api/site-contact.
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { after, describe, test } from "node:test"
import {
  SITE_CONTACT_DEFAULTS,
  buildSiteContact,
  formatPhoneDisplay,
  normalizeEgyptMobile,
  parseSiteContact,
} from "../shared/siteContact.mjs"
import { createApp } from "./app.mjs"
import { createSiteContact } from "./siteContact.mjs"

/** The live Welp record's contact fields as read on 2026-11-19. */
const WELP = { id: 84116, phone_number: "01278166686", whatsapp: "+201278166686", branches: "[]", street: null }

describe("shared/siteContact", () => {
  test("defaults are the values the Contact page showed before the move", () => {
    const c = buildSiteContact(null)
    assert.equal(c.email, "info@perfumira.net")
    assert.equal(c.whatsapp, "+201278166686")
    assert.equal(c.phoneDisplay, "+20 127 816 6686")
    assert.equal(c.phoneHref, "tel:+201278166686")
    assert.deepEqual(c.stores.map((s) => s.id), ["alexandria", "cairo", "mansoura"])
    assert.equal(c.stores[0].name.en, "Alexandria — Sidi Bishr")
    assert.equal(c.stores[0].name.ar, "الإسكندرية — سيدي بشر")
    assert.equal(c.stores[0].address.en, "Intersection of Gamal Abdel Nasser Street and Mohamed Naguib Street")
    assert.equal(c.stores[0].address.ar, "تقاطع شارع جمال عبد الناصر وشارع محمد نجيب")
    assert.equal(c.stores[0].mapUrl, "https://maps.app.goo.gl/pZWhBrwiY1WytfeHA?g_st=awb")
    assert.equal(c.stores[1].mapUrl, "")
    assert.equal(c.stores[2].name.ar, "المنصورة — شارع الاستاد")
    assert.deepEqual(c.source, { phone: "default", email: "config", stores: "config" })
  })

  test("the live Welp record gives the same number, marked as from Welp", () => {
    const c = buildSiteContact(WELP)
    assert.equal(c.whatsapp, SITE_CONTACT_DEFAULTS.whatsapp)
    assert.equal(c.source.phone, "welp")
  })

  test("a number changed in Welp reaches the page", () => {
    const c = buildSiteContact({ ...WELP, whatsapp: "+20 100 123 4567" })
    assert.equal(c.phoneDisplay, "+20 100 123 4567")
    assert.equal(c.phoneHref, "tel:+201001234567")
  })

  test("phone_number is used when whatsapp is empty; junk keeps the default", () => {
    assert.equal(buildSiteContact({ whatsapp: "", phone_number: "01112223334" }).whatsapp, "+201112223334")
    for (const bad of [null, "", "123", "+1 555 0100", "<script>", 42])
      assert.equal(buildSiteContact({ whatsapp: bad, phone_number: bad }).whatsapp, "+201278166686", String(bad))
  })

  test("normalizeEgyptMobile accepts the usual spellings only", () => {
    for (const ok of ["+201278166686", "01278166686", "00201278166686", "201278166686", "+20 127 816 6686", "0127-816-6686"])
      assert.equal(normalizeEgyptMobile(ok), "+201278166686", ok)
    for (const bad of ["0227816668", "+2012781666", "1278166686x", undefined]) assert.equal(normalizeEgyptMobile(bad), null, String(bad))
    assert.equal(formatPhoneDisplay("+201278166686"), "+20 127 816 6686")
  })

  test("parseSiteContact accepts the API payload and rejects malformed ones", () => {
    const { source, ...payload } = buildSiteContact(WELP)
    assert.deepEqual(parseSiteContact(JSON.parse(JSON.stringify(payload))), payload)
    assert.equal(parseSiteContact(null), null)
    assert.equal(parseSiteContact({ ...payload, email: "nope" }), null)
    assert.equal(parseSiteContact({ ...payload, whatsapp: "123" }), null)
    assert.equal(parseSiteContact({ ...payload, stores: [{ id: "x", name: "y" }] }), null)
    // A non-https map link is dropped, never rendered as a link.
    const odd = parseSiteContact({ ...payload, stores: [{ ...payload.stores[0], mapUrl: "javascript:alert(1)" }] })
    assert.equal(odd.stores[0].mapUrl, "")
  })
})

describe("server/siteContact cache", () => {
  const clock = () => {
    let t = 0
    return { now: () => t, advance: (ms) => (t += ms) }
  }

  test("reads Welp once within the TTL", async () => {
    let calls = 0
    const c = clock()
    const sc = createSiteContact({ fetchRecord: async () => (calls++, WELP), now: c.now })
    assert.equal((await sc.get()).source.phone, "welp")
    await sc.get()
    c.advance(14 * 60 * 1000)
    await sc.get()
    assert.equal(calls, 1)
  })

  test("Welp down on the first read: defaults, never an error; cooldown limits retries", async () => {
    let calls = 0
    const c = clock()
    const sc = createSiteContact({ fetchRecord: async () => { calls++; throw new Error("down") }, now: c.now })
    const first = await sc.get()
    assert.equal(first.whatsapp, "+201278166686")
    assert.equal(first.source.phone, "default")
    await sc.get()
    assert.equal(calls, 1)
    c.advance(61 * 1000)
    await sc.get()
    assert.equal(calls, 2)
  })

  test("stale value is served while Welp is re-read, and kept if the re-read fails", async () => {
    let fail = false
    let calls = 0
    const c = clock()
    const sc = createSiteContact({
      fetchRecord: async () => { calls++; if (fail) throw new Error("down"); return { ...WELP, whatsapp: "+201001234567" } },
      now: c.now,
    })
    assert.equal((await sc.get()).whatsapp, "+201001234567")
    fail = true
    c.advance(16 * 60 * 1000)
    assert.equal((await sc.get()).whatsapp, "+201001234567")
    await new Promise((r) => setImmediate(r))
    assert.equal(calls, 2)
    assert.equal((await sc.get()).whatsapp, "+201001234567")
  })
})

describe("GET /api/site-contact", () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), "perfumira-dist-"))
  fs.writeFileSync(path.join(distDir, "index.html"), "<!doctype html><div id=root>")
  const servers = []
  after(() => {
    for (const s of servers) s.close()
    fs.rmSync(distDir, { recursive: true, force: true })
  })
  const start = async (fetchRecord) => {
    const app = createApp({
      distDir,
      transport: null,
      mail: null,
      siteContact: createSiteContact({ fetchRecord }),
      log: () => {},
    })
    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s))
    })
    servers.push(server)
    return `http://127.0.0.1:${server.address().port}/api/site-contact`
  }

  test("serves the Welp-backed contact settings, cacheable for 5 minutes", async () => {
    const response = await fetch(await start(async () => WELP))
    assert.equal(response.status, 200)
    assert.match(response.headers.get("cache-control"), /public, max-age=300/)
    const body = await response.json()
    assert.equal(body.phoneSource, "welp")
    assert.equal(body.email, "info@perfumira.net")
    assert.equal(body.phoneDisplay, "+20 127 816 6686")
    assert.equal(body.stores.length, 3)
    assert.ok(parseSiteContact(body))
  })

  test("Welp down: still 200 with the configured values", async () => {
    const body = await (await fetch(await start(async () => { throw new Error("down") }))).json()
    assert.equal(body.phoneSource, "default")
    assert.equal(body.whatsapp, "+201278166686")
  })
})
