// Newsletter database: applies supabase/migrations to an in-process Postgres
// (PGlite) with the same Supabase stand-in as database.mjs, then checks that
// visitors can only subscribe through subscribe_newsletter() and can never
// read, list, change or delete the list. No network and no Supabase project.
import { PGlite } from "@electric-sql/pglite"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createReport } from "./lib.mjs"

const MIGRATIONS = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url))
const db = new PGlite()
const report = createReport("Newsletter database (table, RLS, subscribe RPC)")
const check = (ok, label, extra) => report.check(ok, label, ok ? "" : (extra ?? ""))

// --- Supabase shim (what a hosted project already has) ---
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}',
    is_anonymous boolean not null default false, created_at timestamptz not null default now());
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create role outsider nologin;
  grant usage on schema public to anon, authenticated, service_role, outsider;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant execute on function auth.jwt() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`)

// The uncommitted orders migration is checked by database.mjs, not here.
for (const file of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f !== "20261022090000_verified_orders.sql").sort()) {
  await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), "utf8"))
  console.log("applied " + file)
}

const GUEST = "44444444-4444-4444-4444-444444444444"
await db.query(`insert into auth.users (id, is_anonymous) values ($1, true)`, [GUEST])

/** Runs `fn` as a role (and user) inside a committed transaction. */
async function as(role, uid, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`)
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ""])
    return fn(tx)
  })
}
async function error(role, uid, sql, params = []) {
  try {
    await as(role, uid, (tx) => tx.query(sql, params))
    return null
  } catch (e) {
    return e
  }
}
const subscribe = async (role, uid, ...args) =>
  (await as(role, uid, (tx) => tx.query(
    `select public.subscribe_newsletter(${args.map((_, i) => `$${i + 1}`).join(", ")}) as result`, args,
  ))).rows[0].result
const all = async () => (await db.query(`select * from public.newsletter_subscribers order by subscribed_at`)).rows

// ---------- Schema ----------
const columns = (await db.query(`select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'newsletter_subscribers' order by ordinal_position`)).rows.map((r) => r.column_name)
check(
  columns.join() === "id,email,email_normalized,locale,source,status,subscribed_at,updated_at,unsubscribed_at",
  "schema: table has exactly the expected columns (no IP or user agent)", columns,
)
check((await db.query(`select relrowsecurity from pg_class where oid = 'public.newsletter_subscribers'::regclass`)).rows[0].relrowsecurity,
  "schema: row level security is on")
check((await db.query(`select count(*)::int n from pg_policies where tablename = 'newsletter_subscribers'`)).rows[0].n === 0,
  "schema: no policies (no client row access at all)")
const fn = (await db.query(`select prosecdef, proconfig, prorettype::regtype::text rettype from pg_proc where proname = 'subscribe_newsletter'`)).rows[0]
check(fn.prosecdef && fn.proconfig?.some((c) => c.startsWith("search_path=")) && fn.rettype === "text",
  "schema: RPC is security definer, has a fixed search path and returns only text", fn)

// ---------- Privileges ----------
for (const role of ["anon", "authenticated"]) {
  for (const p of ["select", "insert", "update", "delete"])
    check(!(await db.query(`select has_table_privilege($1, 'public.newsletter_subscribers', $2) ok`, [role, p])).rows[0].ok,
      `privileges: ${role} has no ${p} on the table`)
  check((await db.query(`select has_function_privilege($1, 'public.subscribe_newsletter(text,text,text)', 'execute') ok`, [role])).rows[0].ok,
    `privileges: ${role} can execute subscribe_newsletter`)
}
check(!(await db.query(`select has_function_privilege('outsider', 'public.subscribe_newsletter(text,text,text)', 'execute') ok`)).rows[0].ok,
  "privileges: PUBLIC (any other role) cannot execute subscribe_newsletter")

// ---------- Subscribe ----------
check((await subscribe("anon", null, "  Nour.Hassan@Example.COM ", "en", "footer")) === "subscribed", "rpc: anon subscribes (English)")
let list = await all()
check(list.length === 1 && list[0].email === "Nour.Hassan@Example.COM" && list[0].email_normalized === "nour.hassan@example.com",
  "rpc: address trimmed; normalized form is lower case", list[0])
check(list[0].locale === "en" && list[0].source === "footer" && list[0].status === "active" && list[0].unsubscribed_at === null,
  "rpc: locale, source and active status stored", list[0])

check((await subscribe("anon", null, "sara@example.com", "ar")) === "subscribed", "rpc: Arabic subscription (source defaults to footer)")
check((await all()).find((r) => r.email_normalized === "sara@example.com")?.locale === "ar", "rpc: Arabic locale stored")

const before = (await all()).find((r) => r.email_normalized === "nour.hassan@example.com")
check((await subscribe("anon", null, "NOUR.hassan@example.com", "ar")) === "already_subscribed", "rpc: duplicate (other case) is already_subscribed")
const afterDup = (await all()).find((r) => r.email_normalized === "nour.hassan@example.com")
check((await all()).length === 2 && afterDup.locale === "en" && +afterDup.updated_at === +before.updated_at,
  "rpc: duplicate adds no row and changes nothing", afterDup)

check((await subscribe("authenticated", GUEST, "guest@example.com", "en")) === "subscribed", "rpc: signed-in / anonymous-guest session can subscribe")

// ---------- Validation ----------
for (const [value, label] of [["bad@", "no domain"], ["no-at.example.com", "no @"], ["a b@example.com", "space"], ["", "empty"],
  [null, "null"], [`${"a".repeat(250)}@example.com`, "over 254 characters"], ["x@y.c", "one-letter TLD"]]) {
  const e = await error("anon", null, `select public.subscribe_newsletter($1)`, [value])
  check(e?.message === "invalid_email" && e?.code === "22023", `validation: rejects email (${label})`, e?.message)
}
let e = await error("anon", null, `select public.subscribe_newsletter('ok@example.com', 'fr')`)
check(e?.message === "invalid_locale", "validation: rejects locale other than en/ar", e?.message)
e = await error("anon", null, `select public.subscribe_newsletter('ok@example.com', 'en', 'popup')`)
check(e?.message === "invalid_source", "validation: rejects unknown source", e?.message)
check((await all()).length === 3, "validation: rejected calls stored nothing")

// ---------- Reactivation ----------
await db.query(`update public.newsletter_subscribers set status = 'unsubscribed', unsubscribed_at = now() where email_normalized = 'sara@example.com'`)
const unsub = (await all()).find((r) => r.email_normalized === "sara@example.com")
check((await subscribe("anon", null, "Sara@Example.com", "en")) === "subscribed", "reactivation: unsubscribed address subscribes again")
const re = (await all()).find((r) => r.email_normalized === "sara@example.com")
check(re.status === "active" && re.unsubscribed_at === null && re.locale === "en" && re.email === "Sara@Example.com"
  && +re.updated_at >= +unsub.updated_at && (await all()).length === 3, "reactivation: same row, active again, new locale", re)
e = await error("service_role", null, `update public.newsletter_subscribers set status = 'unsubscribed' where email_normalized = 'sara@example.com'`)
check(e !== null, "constraint: unsubscribed requires unsubscribed_at")
e = await error("service_role", null, `insert into public.newsletter_subscribers (email, email_normalized) values ('A@b.co', 'A@b.co')`)
check(e !== null, "constraint: normalized column must be lower case and trimmed")

// ---------- No leakage ----------
for (const role of ["anon", "authenticated"]) {
  const uid = role === "anon" ? null : GUEST
  for (const [sql, label] of [
    [`select * from public.newsletter_subscribers`, "list"],
    [`select count(*) from public.newsletter_subscribers`, "count"],
    [`select email from public.newsletter_subscribers where email_normalized = 'nour.hassan@example.com'`, "look up an email"],
    [`insert into public.newsletter_subscribers (email, email_normalized) values ('x@example.com', 'x@example.com')`, "insert directly"],
    [`update public.newsletter_subscribers set status = 'unsubscribed', unsubscribed_at = now()`, "update"],
    [`delete from public.newsletter_subscribers`, "delete"],
  ]) {
    e = await error(role, uid, sql)
    check(e?.code === "42501", `leakage: ${role} cannot ${label}`, e?.message ?? "no error")
  }
}
check((await all()).length === 3 && (await all()).every((r) => r.status === "active"), "leakage: list unchanged after all attempts")

await db.close()
report.finish()
