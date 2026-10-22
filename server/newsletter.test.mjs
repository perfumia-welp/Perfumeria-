/*
 * Tests for the newsletter sign-up (POST /api/newsletter, server/newsletter.mjs).
 * Run with `npm run test:server`.
 *
 * No network: the app gets a fake subscriber list in place of Supabase, and
 * the Supabase client is tested against a fake fetch. No email is sent.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { after, before, beforeEach, describe, test } from "node:test"
import { createApp } from "./app.mjs"
import {
  NewsletterError,
  supabaseNewsletter,
  validateNewsletter,
} from "./newsletter.mjs"

const MAIL = { from: "Perfumira Website <info@perfumira.net>", to: "info@perfumira.net" }

/** In-memory stand-in for the Supabase list (same answers as the SQL function). */
function fakeList() {
  return {
    rows: new Map(),
    calls: [],
    fail: null,
    async subscribe({ email, locale }) {
      this.calls.push({ email, locale })
      if (this.fail) throw this.fail
      const key = email.trim().toLowerCase()
      if (this.rows.has(key)) return "already_subscribed"
      this.rows.set(key, { email, locale })
      return "subscribed"
    },
  }
}

function fakeTransport() {
  return {
    sent: [],
    async sendMail(message) {
      this.sent.push(message)
    },
  }
}

const distDir = fs.mkdtempSync(path.join(os.tmpdir(), "perfumira-dist-"))
fs.writeFileSync(path.join(distDir, "index.html"), "<!doctype html><div id=root>")

const servers = []
const logs = []

async function start({ list = fakeList(), newsletterLimit, enabled = true } = {}) {
  const transport = fakeTransport()
  const app = createApp({
    distDir,
    transport,
    mail: MAIL,
    newsletter: enabled ? (value) => list.subscribe(value) : null,
    newsletterLimit,
    log: (message, detail) => logs.push({ message, detail }),
  })
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s))
  })
  servers.push(server)
  return { url: `http://127.0.0.1:${server.address().port}`, list, transport }
}

const post = (url, body, headers = {}) =>
  fetch(`${url}/api/newsletter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })

const LOOSE = { windowMs: 60000, limit: 1000 }

after(() => {
  for (const server of servers) server.close()
  fs.rmSync(distDir, { recursive: true, force: true })
})

describe("validateNewsletter", () => {
  test("accepts a valid address and trims it; locale defaults to English", () => {
    assert.deepEqual(validateNewsletter({ email: "  Nour@Example.com ", nectar: "" }), {
      ok: true,
      value: { email: "Nour@Example.com", locale: "en" },
    })
    assert.deepEqual(validateNewsletter({ email: "a@b.co", locale: "ar" }).value, {
      email: "a@b.co",
      locale: "ar",
    })
  })

  test("rejects bad addresses and locales by field", () => {
    for (const email of ["", "bad@", "a b@example.com", "x@y.c", `${"a".repeat(250)}@example.com`])
      assert.deepEqual(validateNewsletter({ email }).fields, ["email"], email)
    assert.deepEqual(validateNewsletter({ email: "a@b.co", locale: "fr" }).fields, ["locale"])
  })

  test("non-objects, non-string fields and a filled honeypot are invalid requests", () => {
    for (const body of [null, [], "x", 3, { email: ["a@b.co"] }, { email: "a@b.co", locale: 1 },
      { email: "a@b.co", nectar: "bot" }])
      assert.equal(validateNewsletter(body).error, "invalid_request", JSON.stringify(body))
  })
})

describe("POST /api/newsletter", () => {
  let site
  before(async () => {
    site = await start({ newsletterLimit: LOOSE })
  })
  beforeEach(() => {
    site.list.rows.clear()
    site.list.calls.length = 0
    site.list.fail = null
    logs.length = 0
  })

  test("valid English subscription", async () => {
    const response = await post(site.url, { email: "nour@example.com", locale: "en", nectar: "" })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, status: "subscribed" })
    assert.deepEqual(site.list.calls, [{ email: "nour@example.com", locale: "en" }])
    assert.equal(response.headers.get("cache-control"), "no-store")
  })

  test("valid Arabic subscription keeps the locale", async () => {
    const response = await post(site.url, { email: "sara@example.com", locale: "ar" })
    assert.deepEqual(await response.json(), { ok: true, status: "subscribed" })
    assert.equal(site.list.calls[0].locale, "ar")
  })

  test("address is trimmed before it reaches the list", async () => {
    await post(site.url, { email: "  Nour@Example.COM  ", locale: "en" })
    assert.equal(site.list.calls[0].email, "Nour@Example.COM")
  })

  test("duplicate subscription answers already_subscribed (200, not an error)", async () => {
    await post(site.url, { email: "nour@example.com", locale: "en" })
    const again = await post(site.url, { email: "NOUR@example.com", locale: "ar" })
    assert.equal(again.status, 200)
    assert.deepEqual(await again.json(), { ok: true, status: "already_subscribed" })
    assert.equal(site.list.rows.size, 1)
  })

  test("invalid email is a 400 validation error and nothing is stored", async () => {
    const response = await post(site.url, { email: "bad@", locale: "en" })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { ok: false, error: "validation", fields: ["email"] })
    assert.equal(site.list.calls.length, 0)
  })

  test("unknown locale is rejected", async () => {
    const response = await post(site.url, { email: "a@b.co", locale: "fr" })
    assert.deepEqual(await response.json(), { ok: false, error: "validation", fields: ["locale"] })
  })

  test("filled honeypot is rejected and nothing is stored", async () => {
    const response = await post(site.url, { email: "bot@example.com", locale: "en", nectar: "http://spam" })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { ok: false, error: "invalid_request" })
    assert.equal(site.list.calls.length, 0)
  })

  test("malformed JSON is a 400 invalid_request", async () => {
    const response = await post(site.url, '{"email": "a@b.co",')
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { ok: false, error: "invalid_request" })
  })

  test("a JSON array or non-JSON content type is refused", async () => {
    assert.equal((await post(site.url, "[]")).status, 400)
    const form = await post(site.url, "email=a%40b.co", { "Content-Type": "application/x-www-form-urlencoded" })
    assert.equal(form.status, 415)
    assert.equal(site.list.calls.length, 0)
  })

  test("oversized body is a 413", async () => {
    const response = await post(site.url, { email: "a@b.co", padding: "x".repeat(5000) })
    assert.equal(response.status, 413)
    assert.equal((await response.json()).error, "payload_too_large")
    assert.equal(site.list.calls.length, 0)
  })

  test("database failure is a generic 502: no internal detail and no address in the log", async () => {
    site.list.fail = new NewsletterError("subscribe_failed", { status: 500, code: "XX000" })
    const response = await post(site.url, { email: "nour@example.com", locale: "en" })
    assert.equal(response.status, 502)
    const body = await response.json()
    assert.deepEqual(body, { ok: false, error: "subscribe_failed" })
    assert.equal(logs.length, 1)
    assert.doesNotMatch(JSON.stringify(logs), /nour@example\.com/)
  })

  test("an unexpected exception is also a generic 502", async () => {
    site.list.fail = new Error("connect ECONNREFUSED 10.0.0.1:5432 password=secret")
    const response = await post(site.url, { email: "nour@example.com", locale: "en" })
    assert.equal(response.status, 502)
    assert.doesNotMatch(await response.text(), /ECONNREFUSED|secret|5432/)
  })

  test("database rejecting the address is a validation error", async () => {
    site.list.fail = new NewsletterError("invalid_email")
    const response = await post(site.url, { email: "edge@example.com", locale: "en" })
    assert.equal(response.status, 400)
    assert.deepEqual((await response.json()).fields, ["email"])
  })

  test("responses never contain other subscribers", async () => {
    await post(site.url, { email: "first@example.com", locale: "en" })
    const text = await (await post(site.url, { email: "second@example.com", locale: "en" })).text()
    assert.doesNotMatch(text, /first@example\.com/)
    assert.deepEqual(JSON.parse(text), { ok: true, status: "subscribed" })
  })

  test("no email is sent for a subscription", async () => {
    await post(site.url, { email: "nour@example.com", locale: "en" })
    assert.equal(site.transport.sent.length, 0)
  })

  test("GET is not allowed", async () => {
    const response = await fetch(`${site.url}/api/newsletter`)
    assert.equal(response.status, 405)
    assert.equal(response.headers.get("allow"), "POST")
  })
})

describe("newsletter not configured", () => {
  test("valid request gets 503 unavailable; invalid ones are still rejected first", async () => {
    const site = await start({ enabled: false, newsletterLimit: LOOSE })
    const response = await post(site.url, { email: "nour@example.com", locale: "en" })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { ok: false, error: "unavailable" })
    assert.equal((await post(site.url, { email: "bad@" })).status, 400)
  })
})

describe("newsletter rate limit", () => {
  test("too many sign-ups from one visitor get 429 and reach the list no more", async () => {
    const site = await start({ newsletterLimit: { windowMs: 60000, limit: 2 } })
    await post(site.url, { email: "one@example.com" })
    await post(site.url, { email: "two@example.com" })
    const limited = await post(site.url, { email: "three@example.com" })
    assert.equal(limited.status, 429)
    assert.deepEqual(await limited.json(), { ok: false, error: "rate_limited" })
    assert.equal(site.list.calls.length, 2)
  })
})

describe("supabaseNewsletter (REST client)", () => {
  const URL_ = "https://project.supabase.co/"
  const KEY = "sb_publishable_test"

  /** PostgREST answers JSON (a text result is a JSON string); `raw` sends the body as is. */
  function fakeFetch(status, body, raw = false) {
    const calls = []
    const impl = async (url, init) => {
      calls.push({ url, init })
      return new Response(raw ? body : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    }
    return { impl, calls }
  }

  test("calls the RPC with the publishable key and the footer source", async () => {
    const f = fakeFetch(200, "subscribed")
    const subscribe = supabaseNewsletter({ url: URL_, publishableKey: KEY, fetch: f.impl })
    assert.equal(await subscribe({ email: "a@b.co", locale: "ar" }), "subscribed")
    const [{ url, init }] = f.calls
    assert.equal(url, "https://project.supabase.co/rest/v1/rpc/subscribe_newsletter")
    assert.equal(init.method, "POST")
    assert.equal(init.headers.apikey, KEY)
    assert.equal(init.headers.Authorization, undefined)
    assert.deepEqual(JSON.parse(init.body), { p_email: "a@b.co", p_locale: "ar", p_source: "footer" })
  })

  test("returns already_subscribed as given", async () => {
    const f = fakeFetch(200, "already_subscribed")
    const subscribe = supabaseNewsletter({ url: URL_, publishableKey: KEY, fetch: f.impl })
    assert.equal(await subscribe({ email: "a@b.co", locale: "en" }), "already_subscribed")
  })

  test("database invalid_email maps to NewsletterError invalid_email", async () => {
    const f = fakeFetch(400, { code: "22023", message: "invalid_email", details: null, hint: null })
    const subscribe = supabaseNewsletter({ url: URL_, publishableKey: KEY, fetch: f.impl })
    await assert.rejects(subscribe({ email: "a@b.co", locale: "en" }), { code: "invalid_email" })
  })

  test("missing function, server errors, odd answers and network failure are subscribe_failed", async () => {
    for (const [status, body, raw] of [[404, { code: "PGRST202", message: "Could not find the function" }],
      [500, { code: "XX000", message: "boom" }], [200, "something_else"], [200, "<html>", true]]) {
      const subscribe = supabaseNewsletter({ url: URL_, publishableKey: KEY, fetch: fakeFetch(status, body, raw).impl })
      await assert.rejects(subscribe({ email: "a@b.co", locale: "en" }), { code: "subscribe_failed" }, String(status))
    }
    const down = supabaseNewsletter({
      url: URL_, publishableKey: KEY,
      fetch: async () => { throw new TypeError("fetch failed") },
    })
    await assert.rejects(down({ email: "a@b.co", locale: "en" }), { code: "subscribe_failed" })
  })
})
