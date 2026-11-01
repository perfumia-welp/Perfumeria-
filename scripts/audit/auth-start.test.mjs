import assert from "node:assert/strict"
import { test } from "node:test"
import { createClient } from "@supabase/supabase-js"
import {
  authStorageKey,
  hasAuthLinkParams,
  hasStoredSession,
} from "../../src/lib/authStart.ts"

const URL_ = "https://qdsfigurvejzzftvzudn.supabase.co"

test("the session key is the one supabase-js uses by default, so existing sessions are found", () => {
  const client = createClient(URL_, "sb_publishable_test", {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  assert.equal(client.storageKey, authStorageKey(URL_))
  assert.equal(authStorageKey(URL_), "sb-qdsfigurvejzzftvzudn-auth-token")
})

test("a malformed Supabase URL has no session key rather than throwing", () => {
  assert.equal(authStorageKey("not a url"), "")
})

test("email links are recognised in the fragment and the query", () => {
  for (const hash of [
    "#access_token=a&refresh_token=b&type=signup",
    "#access_token=a&type=recovery",
    "#error=access_denied&error_code=otp_expired&error_description=x",
  ])
    assert.equal(hasAuthLinkParams(hash, ""), true, hash)
  for (const search of ["?code=abc", "?token_hash=abc&type=email", "?error_description=x"])
    assert.equal(hasAuthLinkParams("", search), true, search)
})

test("ordinary page addresses are not email links", () => {
  for (const [hash, search] of [
    ["", ""],
    ["#products", ""],
    ["#main", "?page=2"],
    ["", "?q=oud&sort=price-asc&gender=women"],
    ["", "?topic=wholesale"],
  ])
    assert.equal(hasAuthLinkParams(hash, search), false, `${hash} ${search}`)
})

test("a stored session is detected; none, no key or blocked storage count as no session", () => {
  const key = authStorageKey(URL_)
  const store = new Map()
  globalThis.window = {
    localStorage: { getItem: (name) => store.get(name) ?? null },
  }
  assert.equal(hasStoredSession(key), false)
  assert.equal(hasStoredSession(""), false)
  store.set(key, "{}")
  assert.equal(hasStoredSession(key), true)
  store.set("sb-other-auth-token", "{}")
  store.delete(key)
  assert.equal(hasStoredSession(key), false)
  globalThis.window = {
    get localStorage() {
      throw new Error("blocked")
    },
  }
  assert.equal(hasStoredSession(key), false)
  delete globalThis.window
})
