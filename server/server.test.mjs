/*
 * Tests for the production server (server/app.mjs) and the contact email
 * (server/contact.mjs). Run with `npm run test:server`.
 *
 * No email is sent: the app gets a fake transport in place of Nodemailer's,
 * which records each message or fails on request. A temporary dist/ stands
 * in for the Vite build.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { after, before, beforeEach, describe, test } from "node:test"
import nodemailer from "nodemailer"
import { createApp } from "./app.mjs"
import { buildContactEmail, escapeHtml, validateContact } from "./contact.mjs"

const MAIL = {
  from: "Perfumira Website <info@perfumira.net>",
  to: "info@perfumira.net",
}

const VALID = {
  fullName: "Nour Hassan",
  email: "nour@example.com",
  phone: "+20 100 123 4567",
  subject: "A question",
  message: "Hello,\nDo you have this in 50 ml?",
  locale: "en",
  pageUrl: "https://perfumira.net/contact",
  nectar: "",
}

function fakeTransport() {
  return {
    sent: [],
    fail: null,
    async sendMail(message) {
      if (this.fail) throw this.fail
      this.sent.push(message)
      return { messageId: "test" }
    },
  }
}

const distDir = fs.mkdtempSync(path.join(os.tmpdir(), "perfumira-dist-"))
fs.mkdirSync(path.join(distDir, "assets"))
fs.writeFileSync(
  path.join(distDir, "index.html"),
  "<!doctype html><div id=root>",
)
fs.writeFileSync(path.join(distDir, "assets", "index-abc.js"), "console.log(1)")
fs.writeFileSync(path.join(distDir, "robots.txt"), "User-agent: *")
fs.writeFileSync(path.join(distDir, "_headers"), "/*\n  X-Robots-Tag: noindex")

const servers = []
const logs = []

/** Starts an app on a free port; returns its base URL and transport. */
async function start(options = {}) {
  const transport =
    options.transport === undefined ? fakeTransport() : options.transport
  const app = createApp({
    distDir,
    transport,
    mail: MAIL,
    contactLimit: options.contactLimit,
    log: (message, detail) => logs.push({ message, detail }),
  })
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s))
  })
  servers.push(server)
  return { url: `http://127.0.0.1:${server.address().port}`, transport }
}

const post = (url, body, headers = {}) =>
  fetch(`${url}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })

after(() => {
  for (const server of servers) server.close()
  fs.rmSync(distDir, { recursive: true, force: true })
})

describe("POST /api/contact", () => {
  let site
  before(async () => {
    site = await start({ contactLimit: { windowMs: 60000, limit: 1000 } })
  })
  beforeEach(() => {
    site.transport.sent.length = 0
    site.transport.fail = null
    logs.length = 0
  })

  test("valid submission is emailed to the store with Reply-To", async () => {
    const response = await post(site.url, VALID)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
    assert.equal(site.transport.sent.length, 1)
    const [mail] = site.transport.sent
    assert.equal(mail.from, MAIL.from)
    assert.equal(mail.to, "info@perfumira.net")
    assert.deepEqual(mail.replyTo, {
      name: "Nour Hassan",
      address: "nour@example.com",
    })
    assert.equal(
      mail.subject,
      "Perfumira Website – Contact Inquiry – Nour Hassan",
    )
    for (const part of [mail.text, mail.html]) {
      assert.match(part, /Nour Hassan/)
      assert.match(part, /nour@example\.com/)
      assert.match(part, /\+20 100 123 4567/)
      assert.match(part, /General inquiry/)
      assert.match(part, /English/)
      assert.match(part, /https:\/\/perfumira\.net\/contact/)
      assert.match(part, /Do you have this in 50 ml\?/)
    }
    assert.match(mail.text, /Submitted: .+\(Cairo\)/)
    assert.equal(response.headers.get("cache-control"), "no-store")
  })

  test("the visitor's address is never the sender", async () => {
    await post(site.url, { ...VALID, from: "attacker@example.com" })
    assert.equal(site.transport.sent[0].from, MAIL.from)
    assert.equal(site.transport.sent[0].to, MAIL.to)
  })

  test("wholesale topic has its own subject", async () => {
    const response = await post(site.url, { ...VALID, topic: "wholesale" })
    assert.equal(response.status, 200)
    const [mail] = site.transport.sent
    assert.equal(
      mail.subject,
      "Perfumira Website – Wholesale Inquiry – Nour Hassan",
    )
    assert.match(mail.text, /Topic: Wholesale/)
  })

  test("track-order topic has its own subject", async () => {
    const response = await post(site.url, {
      ...VALID,
      topic: "track-order",
      locale: "ar",
      message: "طلبي رقم PF-1234",
    })
    assert.equal(response.status, 200)
    const [mail] = site.transport.sent
    assert.equal(
      mail.subject,
      "Perfumira Website – Track Order Request – Nour Hassan",
    )
    assert.match(mail.text, /Topic: Track order/)
    assert.match(mail.text, /Language: Arabic/)
    assert.match(mail.text, /PF-1234/)
  })

  test("optional fields left empty are not listed", async () => {
    await post(site.url, { ...VALID, phone: "", pageUrl: "" })
    const [mail] = site.transport.sent
    assert.doesNotMatch(mail.text, /Phone:/)
    assert.doesNotMatch(mail.text, /Page:/)
  })

  test("invalid email is rejected and nothing is sent", async () => {
    const response = await post(site.url, { ...VALID, email: "nour@" })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "validation",
      fields: ["email"],
    })
    assert.equal(site.transport.sent.length, 0)
  })

  test("missing required fields are rejected", async () => {
    const response = await post(site.url, {
      email: "nour@example.com",
      fullName: "   ",
      locale: "en",
    })
    assert.equal(response.status, 400)
    const body = await response.json()
    assert.deepEqual(body.fields, ["fullName", "subject", "message"])
    assert.equal(site.transport.sent.length, 0)
  })

  test("over-long fields and unknown topics are rejected", async () => {
    const response = await post(site.url, {
      ...VALID,
      message: "x".repeat(5001),
      topic: "refund",
    })
    assert.equal(response.status, 400)
    assert.deepEqual((await response.json()).fields, ["message", "topic"])
  })

  test("honeypot submissions are rejected and nothing is sent", async () => {
    const response = await post(site.url, { ...VALID, nectar: "http://spam" })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "invalid_request",
    })
    assert.equal(site.transport.sent.length, 0)
  })

  test("malformed bodies are rejected with JSON", async () => {
    for (const body of [
      "{not json",
      "[1,2]",
      JSON.stringify({ ...VALID, email: 5 }),
    ]) {
      const response = await post(site.url, body)
      assert.equal(response.status, 400, body)
      assert.equal((await response.json()).error, "invalid_request")
    }
    const form = await post(site.url, "a=b", {
      "Content-Type": "application/x-www-form-urlencoded",
    })
    assert.equal(form.status, 415)
    assert.equal(site.transport.sent.length, 0)
  })

  test("oversized bodies are refused", async () => {
    const response = await post(site.url, {
      ...VALID,
      message: "x".repeat(40 * 1024),
    })
    assert.equal(response.status, 413)
    assert.equal((await response.json()).error, "payload_too_large")
  })

  test("SMTP failure returns a safe error and logs no message text", async () => {
    site.transport.fail = Object.assign(
      new Error("Invalid login: 535 5.7.8 password=hunter2 rejected"),
      { code: "EAUTH", responseCode: 535, command: "AUTH PLAIN" },
    )
    const response = await post(site.url, VALID)
    assert.equal(response.status, 502)
    const text = await response.text()
    assert.deepEqual(JSON.parse(text), { ok: false, error: "send_failed" })
    assert.doesNotMatch(text, /535|hunter2|AUTH|login/i)
    assert.equal(logs.length, 1)
    assert.deepEqual(logs[0].detail, {
      code: "EAUTH",
      responseCode: 535,
      command: "AUTH PLAIN",
    })
    assert.doesNotMatch(JSON.stringify(logs), /50 ml|nour@example/)
  })

  test("only POST is allowed", async () => {
    const response = await fetch(`${site.url}/api/contact`)
    assert.equal(response.status, 405)
    assert.equal(response.headers.get("allow"), "POST")
  })
})

describe("rate limit", () => {
  test("too many messages from one visitor get 429, then nothing is sent", async () => {
    const site = await start({ contactLimit: { windowMs: 60000, limit: 2 } })
    assert.equal((await post(site.url, VALID)).status, 200)
    assert.equal((await post(site.url, VALID)).status, 200)
    const limited = await post(site.url, VALID)
    assert.equal(limited.status, 429)
    assert.deepEqual(await limited.json(), { ok: false, error: "rate_limited" })
    assert.equal(site.transport.sent.length, 2)
  })
})

describe("mail not configured", () => {
  test("reports unavailable instead of pretending success", async () => {
    const site = await start({ transport: null })
    const response = await post(site.url, VALID)
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { ok: false, error: "unavailable" })
  })
})

describe("site and SPA routing", () => {
  let site
  before(async () => {
    site = await start()
  })

  for (const route of [
    "/",
    "/products",
    "/products/some-perfume-100ml",
    "/ar/products/some-perfume-100ml",
    "/account/orders",
    "/returns",
    "/faq",
    "/guides/how-to-choose",
    "/contact?topic=wholesale",
  ]) {
    test(`${route} serves the app`, async () => {
      const response = await fetch(site.url + route)
      assert.equal(response.status, 200)
      assert.match(response.headers.get("content-type"), /text\/html/)
      assert.equal(response.headers.get("cache-control"), "no-cache")
      assert.match(await response.text(), /id=root/)
    })
  }

  test("built files are served and cached", async () => {
    const response = await fetch(`${site.url}/assets/index-abc.js`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get("content-type"), /javascript/)
    assert.match(response.headers.get("cache-control"), /immutable/)
    assert.equal((await fetch(`${site.url}/robots.txt`)).status, 200)
  })

  test("missing files are 404s, never the HTML page", async () => {
    for (const file of [
      "/assets/old-chunk.js",
      "/images/missing.webp",
      "/missing.css",
    ]) {
      const response = await fetch(site.url + file)
      assert.equal(response.status, 404, file)
      assert.doesNotMatch(await response.text(), /id=root/)
    }
  })

  test("API routes never fall through to the app", async () => {
    const response = await fetch(`${site.url}/api/unknown`)
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { ok: false, error: "not_found" })
    assert.deepEqual(await (await fetch(`${site.url}/api/health`)).json(), {
      ok: true,
    })
  })

  test("host configuration files are not served", async () => {
    assert.equal((await fetch(`${site.url}/_headers`)).status, 404)
  })
})

describe("contact email content", () => {
  test("visitor HTML is escaped, never rendered", () => {
    const result = validateContact({
      ...VALID,
      fullName: '<img src=x onerror="alert(1)">',
      subject: "<b>hi</b>",
      message: "<script>alert('x')</script>",
    })
    assert.ok(result.ok)
    const mail = buildContactEmail(result.value, MAIL)
    assert.doesNotMatch(mail.html, /<script>|<img |<b>hi/)
    assert.match(
      mail.html,
      /&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt;/,
    )
    assert.equal(escapeHtml(`"&'`), "&quot;&amp;&#39;")
  })

  test("header values cannot carry new lines", () => {
    const result = validateContact({
      ...VALID,
      fullName: "Nour\r\nBcc: victim@example.com",
      subject: "Hi\nBcc: x@example.com",
    })
    assert.ok(result.ok)
    const mail = buildContactEmail(result.value, MAIL)
    assert.doesNotMatch(mail.subject, /[\r\n]/)
    assert.doesNotMatch(mail.replyTo.name, /[\r\n]/)
    const injected = validateContact({
      ...VALID,
      email: "nour@example.com\r\nBcc: victim@example.com",
    })
    assert.equal(injected.ok, false)
  })

  test("Nodemailer renders the headers as intended (offline)", async () => {
    // streamTransport builds the raw message in memory; nothing is sent.
    const transport = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: "unix",
    })
    const result = validateContact({
      ...VALID,
      fullName: "Nour\r\nBcc: victim@example.com",
      topic: "wholesale",
    })
    const { message } = await transport.sendMail(
      buildContactEmail(result.value, MAIL),
    )
    const headers = message.toString().split("\n\n")[0]
    assert.match(headers, /^From: Perfumira Website <info@perfumira\.net>$/m)
    assert.match(headers, /^To: info@perfumira\.net$/m)
    assert.match(headers, /^Reply-To: .*<nour@example\.com>$/m)
    assert.doesNotMatch(headers, /^Bcc:/im)
    assert.match(headers, /multipart\/alternative/)
  })
})
