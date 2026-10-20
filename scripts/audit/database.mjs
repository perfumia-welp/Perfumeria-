// Database (Step 3A): applies supabase/migrations to an in-process Postgres
// (PGlite) with a small Supabase stand-in (auth.users, auth.uid(), the anon
// and authenticated roles and Supabase's default grants), then checks the
// schema, triggers, row level security and the order RPC as real customers
// would hit them. No network and no Supabase project are involved.
import { PGlite } from "@electric-sql/pglite"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createReport } from "./lib.mjs"

const MIGRATIONS = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url))
const db = new PGlite()
const report = createReport("Database (migrations, RLS, order RPC)")
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
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant execute on function auth.jwt() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`)

const A = "11111111-1111-1111-1111-111111111111"
const B = "22222222-2222-2222-2222-222222222222"
const C = "33333333-3333-3333-3333-333333333333"
// Existing user BEFORE the migration (like the real test account).
await db.query(`insert into auth.users values ($1, 'a@example.com', '{"first_name":" Sherin ","last_name":"Test"}')`, [A])

for (const file of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), "utf8"))
  console.log("applied " + file)
}

// New sign-ups after the migration.
await db.query(`insert into auth.users values ($1, 'b@example.com', '{"first_name":"Bea","last_name":"Two"}')`, [B])
await db.query(`insert into auth.users values ($1, 'c@example.com', '{}')`, [C])

/** Runs `fn` as a role (and user) inside a transaction that is committed. */
async function as(role, uid, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`)
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ""])
    return fn(tx)
  })
}
async function fails_(role, uid, sql, params = []) {
  try {
    await as(role, uid, (tx) => tx.query(sql, params))
    return null
  } catch (e) {
    return e.message
  }
}
const rows = async (role, uid, sql, params = []) => (await as(role, uid, (tx) => tx.query(sql, params))).rows

// ---------- Profiles ----------
let r = await db.query(`select * from public.profiles order by id`)
check(r.rows.length === 3, "profiles: backfill + trigger created 3 profiles")
check(r.rows[0].first_name === "Sherin" && r.rows[0].last_name === "Test", "profiles: existing user backfilled from metadata (trimmed)", r.rows[0])
check(r.rows[2].first_name === "" && r.rows[2].phone === "", "profiles: user without metadata gets empty profile")

r = await rows("authenticated", A, `select id from public.profiles`)
check(r.length === 1 && r[0].id === A, "profiles: user A sees only own profile")
check((await rows("anon", null, `select 1`)) && (await fails_("anon", null, `select * from public.profiles`)) !== null, "profiles: anon cannot read profiles")
await as("authenticated", A, (tx) => tx.query(`update public.profiles set first_name='Sherin2', phone='+20 100 000 0000' where id=$1`, [A]))
r = await db.query(`select first_name, phone, updated_at > created_at as bumped from public.profiles where id=$1`, [A])
check(r.rows[0].first_name === "Sherin2" && r.rows[0].phone === "+20 100 000 0000", "profiles: owner update persists")
const upd = await as("authenticated", A, (tx) => tx.query(`update public.profiles set first_name='hack' where id=$1`, [B]))
check(upd.affectedRows === 0, "profiles: A cannot update B (0 rows)")
check((await db.query(`select first_name from public.profiles where id=$1`, [B])).rows[0].first_name === "Bea", "profiles: B unchanged")
check((await fails_("authenticated", A, `update public.profiles set id=$1 where id=$2`, [B, A])) !== null, "profiles: cannot change id")
check((await fails_("authenticated", A, `update public.profiles set created_at=now() where id=$1`, [A])) !== null, "profiles: cannot change created_at")
check((await fails_("authenticated", A, `insert into public.profiles (id) values ($1)`, [B])) !== null, "profiles: cannot create a profile for someone else")
check((await fails_("authenticated", A, `delete from public.profiles where id=$1`, [A])) !== null, "profiles: customer cannot delete profile")
check((await fails_("authenticated", A, `update public.profiles set phone=repeat('1',41) where id=$1`, [A])) !== null, "profiles: phone length limited")
// Missing-profile repair via upsert by the owner.
await db.query(`delete from public.profiles where id=$1`, [C])
await as("authenticated", C, (tx) => tx.query(`insert into public.profiles (id, first_name) values ($1,'Cee') on conflict (id) do update set first_name=excluded.first_name`, [C]))
check((await db.query(`select first_name from public.profiles where id=$1`, [C])).rows[0]?.first_name === "Cee", "profiles: owner can recreate a missing profile (upsert)")

// ---------- Addresses ----------
const addr = (label, isDefault = false) =>
  `insert into public.addresses (label, full_name, phone, address, city_area, is_default) values ('${label}','Sara','+20 1','12 Nile St','Cairo', ${isDefault}) returning id, is_default, user_id`
const a1 = (await rows("authenticated", A, addr("Home")))[0]
check(a1.is_default === true && a1.user_id === A, "addresses: first address becomes default, owner from session")
const a2 = (await rows("authenticated", A, addr("Work")))[0]
check(a2.is_default === false, "addresses: second address not default")
const a3 = (await rows("authenticated", A, addr("Mum", true)))[0]
let defs = await rows("authenticated", A, `select label from public.addresses where is_default`)
check(defs.length === 1 && defs[0].label === "Mum", "addresses: inserting as default moves the default")
await as("authenticated", A, (tx) => tx.query(`update public.addresses set is_default=true where id=$1`, [a2.id]))
defs = await rows("authenticated", A, `select label from public.addresses where is_default`)
check(defs.length === 1 && defs[0].label === "Work", "addresses: set default (update) leaves exactly one default")
await as("authenticated", A, (tx) => tx.query(`update public.addresses set is_default=false where id=$1`, [a2.id]))
defs = await rows("authenticated", A, `select label from public.addresses where is_default`)
check(defs.length === 1 && defs[0].label === "Work", "addresses: default cannot be removed without choosing another")
await as("authenticated", A, (tx) => tx.query(`update public.addresses set label='Office', city_area='Giza' where id=$1`, [a2.id]))
check((await db.query(`select label, city_area, is_default from public.addresses where id=$1`, [a2.id])).rows[0].label === "Office", "addresses: edit works and keeps default")
await as("authenticated", A, (tx) => tx.query(`delete from public.addresses where id=$1`, [a2.id]))
defs = await rows("authenticated", A, `select label from public.addresses where is_default`)
check(defs.length === 1 && defs[0].label === "Mum", "addresses: deleting the default promotes the newest remaining", defs)
const b1 = (await rows("authenticated", B, addr("B home")))[0]
check(b1.is_default === true, "addresses: B's first address is default independently of A")
check((await rows("authenticated", B, `select * from public.addresses`)).length === 1, "addresses: B sees only own addresses")
check((await as("authenticated", B, (tx) => tx.query(`update public.addresses set label='x' where id=$1`, [a1.id]))).affectedRows === 0, "addresses: B cannot edit A's address")
check((await as("authenticated", B, (tx) => tx.query(`delete from public.addresses where id=$1`, [a1.id]))).affectedRows === 0, "addresses: B cannot delete A's address")
check((await as("authenticated", B, (tx) => tx.query(`update public.addresses set is_default=true where id=$1`, [a1.id]))).affectedRows === 0, "addresses: B cannot set A's default")
check((await db.query(`select count(*)::int n from public.addresses where user_id=$1 and is_default`, [A])).rows[0].n === 1, "addresses: A still has exactly one default")
check((await fails_("authenticated", B, `insert into public.addresses (user_id, full_name, phone, address, city_area) values ($1,'x','1','x','x')`, [A])) !== null, "addresses: cannot insert for another user")
check((await fails_("authenticated", A, `update public.addresses set user_id=$1 where id=$2`, [B, a1.id])) !== null, "addresses: cannot move an address to another user")
check((await fails_("authenticated", A, `insert into public.addresses (full_name, phone, address, city_area) values ('  ','1','x','x')`)) !== null, "addresses: blank name rejected")
check((await fails_("anon", null, `select * from public.addresses`)) !== null, "addresses: anon has no access")
for (let i = 0; i < 18; i++) await rows("authenticated", A, addr("n" + i))
check((await fails_("authenticated", A, addr("21st")))?.includes("address_limit_reached"), "addresses: limit of 20 per customer")

// ---------- Orders ----------
const request = (ref, extra = {}) => ({
  reference: ref, locale: "ar", customer_name: "سارة أحمد", phone: "+20 100 123 4567", email: "s@example.com",
  delivery_address: "١٢ شارع النيل", city_area: "القاهرة", notes: "", is_gift: true, gift_message: "Happy birthday",
  promo_code: "PRIVATE20", currency: "USD",
  items: [
    { product_ref: "quiet-oud", product_name: "Quiet Oud", size: "75 ml", quantity: 2, unit_price: 179, image_url: "/images/packshots/quiet-oud.webp" },
    { product_ref: "velvet-iris", product_name: "Velvet Iris", size: "50 ml", quantity: 1, unit_price: 138, image_url: "" },
  ],
  ...extra,
})
const rpc = (role, uid, body) => rows(role, uid, `select public.create_order_request($1::jsonb) as id`, [JSON.stringify(body)])
const o1 = (await rpc("authenticated", A, request("PF-261009-AAAA")))[0].id
let ord = (await rows("authenticated", A, `select * from public.orders`))
check(ord.length === 1 && ord[0].id === o1, "orders: authenticated checkout creates exactly one order")
check(ord[0].user_id === A && ord[0].status === "request_created" && ord[0].locale === "ar", "orders: owner = caller, status request_created, locale kept")
check(Number(ord[0].subtotal) === 496 && ord[0].notes === null && ord[0].promo_code === "PRIVATE20" && ord[0].is_gift, "orders: subtotal recalculated, empty notes null, gift/promo kept", ord[0])
let items = await rows("authenticated", A, `select * from public.order_items where order_id=$1 order by position`, [o1])
check(items.length === 2 && items[0].product_name === "Quiet Oud" && items[0].quantity === 2 && Number(items[0].line_total) === 358 && items[1].image_url === null, "orders: items saved in order with snapshots", items)
const again = (await rpc("authenticated", A, request("PF-261009-AAAA")))[0].id
check(again === o1 && (await rows("authenticated", A, `select * from public.orders`)).length === 1, "orders: same reference again is idempotent (no duplicate)")

// Edited resubmit (same reference): updates the one record in place.
const firstRow = (await db.query(`select created_at, updated_at from public.orders where id=$1`, [o1])).rows[0]
const edited = (await rpc("authenticated", A, request("PF-261009-AAAA", {
  customer_name: "Sara Edited", city_area: "Giza", locale: "en", is_gift: false, gift_message: "", user_id: B, status: "delivered", subtotal: 1,
  items: [{ product_ref: "velvet-iris", product_name: "Velvet Iris", size: "50 ml", quantity: 3, unit_price: 138, line_total: 1, image_url: "" }],
})))[0].id
ord = await rows("authenticated", A, `select * from public.orders`)
check(edited === o1 && ord.length === 1, "resubmit: same reference keeps one order (same id)")
check(ord[0].customer_name === "Sara Edited" && ord[0].city_area === "Giza" && ord[0].locale === "en" && !ord[0].is_gift && ord[0].gift_message === null, "resubmit: edited details stored", ord[0])
check(ord[0].user_id === A && ord[0].status === "request_created" && Number(ord[0].subtotal) === 414, "resubmit: owner, status kept; subtotal recalculated", ord[0])
check(ord[0].created_at.getTime() === firstRow.created_at.getTime() && ord[0].updated_at >= firstRow.updated_at, "resubmit: created_at kept, updated_at bumped")
items = await rows("authenticated", A, `select * from public.order_items where order_id=$1 order by position`, [o1])
check(items.length === 1 && items[0].quantity === 3 && Number(items[0].line_total) === 414, "resubmit: items replaced, not appended", items)
const badEdit = await fails_("authenticated", A, `select public.create_order_request($1::jsonb)`, [JSON.stringify(request("PF-261009-AAAA", { customer_name: "Broken", items: [{ product_ref: "y", product_name: "Y", quantity: 500, unit_price: 1 }] }))])
const afterBad = (await db.query(`select customer_name, (select count(*)::int from public.order_items where order_id=$1) n from public.orders where id=$1`, [o1])).rows[0]
check(badEdit !== null && afterBad.customer_name === "Sara Edited" && afterBad.n === 1, "resubmit: invalid edit rolls back (old snapshot kept)", afterBad)
const bSame = (await rpc("authenticated", B, request("PF-261009-AAAA")))[0].id
check(bSame !== o1 && (await db.query(`select customer_name from public.orders where id=$1`, [o1])).rows[0].customer_name === "Sara Edited", "resubmit: another customer with the same reference gets their own order, A untouched")
await db.query(`delete from public.orders where id=$1`, [bSame])
await db.query(`update public.orders set created_at = now() - interval '2 days' where id=$1`, [o1])
const locked = await fails_("authenticated", A, `select public.create_order_request($1::jsonb)`, [JSON.stringify(request("PF-261009-AAAA", { customer_name: "Too Late" }))])
check(locked?.includes("order_locked") && (await db.query(`select customer_name from public.orders where id=$1`, [o1])).rows[0].customer_name === "Sara Edited", "resubmit: orders older than 24 hours are locked", locked)
// Spoofed owner/status/totals are ignored.
const o2 = (await rpc("authenticated", A, request("PF-261009-BBBB", { user_id: B, status: "delivered", subtotal: 1, items: [{ product_ref: "x", product_name: "X", quantity: 3, unit_price: 10, line_total: 1 }] })))[0].id
const o2row = (await db.query(`select user_id, status, subtotal from public.orders where id=$1`, [o2])).rows[0]
check(o2row.user_id === A && o2row.status === "request_created" && Number(o2row.subtotal) === 30, "orders: client cannot spoof owner, status or totals", o2row)
check(Number((await db.query(`select line_total from public.order_items where order_id=$1`, [o2])).rows[0].line_total) === 30, "orders: line_total recalculated")
// Atomic: a bad item rolls back everything.
const before = (await db.query(`select count(*)::int n from public.orders`)).rows[0].n
const bad = await fails_("authenticated", A, `select public.create_order_request($1::jsonb)`, [JSON.stringify(request("PF-261009-CCCC", { items: [request("x").items[0], { product_ref: "y", product_name: "Y", quantity: 500, unit_price: 1 }] }))])
check(bad !== null && (await db.query(`select count(*)::int n from public.orders`)).rows[0].n === before && (await db.query(`select count(*)::int n from public.orders where reference='PF-261009-CCCC'`)).rows[0].n === 0, "orders: invalid item rolls back the whole order (no partial save)", bad)
check((await fails_("authenticated", A, `select public.create_order_request($1::jsonb)`, [JSON.stringify(request("PF-261009-DDDD", { items: [] }))])) !== null, "orders: empty order rejected")
check((await fails_("authenticated", A, `select public.create_order_request($1::jsonb)`, [JSON.stringify(request("PF-261009-EEEE", { locale: "fr" }))])) !== null, "orders: invalid locale rejected")
// Guests.
check((await fails_("anon", null, `select public.create_order_request($1::jsonb)`, [JSON.stringify(request("PF-261009-GGGG"))])) !== null, "orders: guest (anon) cannot call the RPC")
check((await fails_("authenticated", null, `select public.create_order_request($1::jsonb)`, [JSON.stringify(request("PF-261009-HHHH"))]))?.includes("not_authenticated"), "orders: no session uid -> not_authenticated")
check((await db.query(`select count(*)::int n from public.orders where reference in ('PF-261009-GGGG','PF-261009-HHHH')`)).rows[0].n === 0, "orders: guest attempts saved nothing")
// Isolation and immutability.
check((await rows("authenticated", B, `select * from public.orders`)).length === 0, "orders: B sees none of A's orders")
check((await rows("authenticated", B, `select * from public.order_items`)).length === 0, "orders: B sees none of A's items")
check((await fails_("anon", null, `select * from public.orders`)) !== null && (await fails_("anon", null, `select * from public.order_items`)) !== null, "orders: anon cannot read orders/items")
check((await fails_("authenticated", A, `update public.orders set status='delivered' where id=$1`, [o1])) !== null, "orders: customer cannot change status")
check((await fails_("authenticated", A, `update public.orders set subtotal=0 where id=$1`, [o1])) !== null, "orders: customer cannot edit any order field")
check((await fails_("authenticated", A, `update public.order_items set quantity=1 where order_id=$1`, [o1])) !== null, "orders: customer cannot edit items")
check((await fails_("authenticated", A, `delete from public.orders where id=$1`, [o1])) !== null, "orders: customer cannot delete orders")
check((await fails_("authenticated", A, `insert into public.orders (reference,user_id,locale,customer_name,phone,email,delivery_address,city_area,subtotal,currency) values ('X',$1,'en','a','1','e','a','c',1,'USD')`, [A])) !== null, "orders: direct insert blocked (RPC only)")
check((await fails_("authenticated", A, `insert into public.order_items (order_id,position,product_ref,product_name,quantity,unit_price,line_total) values ($1,9,'x','x',1,1,1)`, [o1])) !== null, "orders: direct item insert blocked")
check((await db.query(`select status from public.orders where id=$1`, [o1])).rows[0].status === "request_created", "orders: status still request_created")
// Internal trigger functions are not callable by clients.
check((await fails_("authenticated", A, `select public.handle_new_user()`)) !== null, "functions: handle_new_user not callable")

// Account deletion cascades.
await db.query(`delete from auth.users where id=$1`, [A])
const left = (await db.query(`select (select count(*) from public.profiles where id=$1)+(select count(*) from public.addresses where user_id=$1)+(select count(*) from public.orders where user_id=$1) as n`, [A])).rows[0].n
check(Number(left) === 0, "cascade: deleting the auth user removes profile, addresses and orders")

// Supplemental catalogue: no customer write access, independent business identities.
await db.exec("insert into public.product_metadata (business_id,product_id,brand) values (7,19,'A'),(8,19,'B')")
await db.exec("insert into public.product_gallery (business_id,product_id,image_url) values (7,19,'https://example.test/a.jpg'),(7,20,'https://example.test/alone.jpg')")
for (const role of ['anon', 'authenticated']) {
  for (const table of ['product_metadata', 'product_gallery']) {
    check((await rows(role, null, 'select * from public.' + table)).length === 2, table + ': ' + role + ' can read catalogue')
    const insert = table === 'product_metadata'
      ? "insert into public.product_metadata (business_id,product_id) values (9,9)"
      : "insert into public.product_gallery (business_id,product_id,image_url) values (9,9,'https://example.test/new.jpg')"
    for (const sql of [insert, 'update public.' + table + ' set product_id=99', 'delete from public.' + table]) {
      check((await fails_(role, null, sql)) !== null, table + ': ' + role + ' denied ' + sql.split(' ')[0])
    }
  }
}
check((await fails_('service_role', null, "insert into public.product_metadata (business_id,product_id) values (7,19)")) !== null, 'metadata: duplicate business/product denied')
check((await fails_('service_role', null, "insert into public.product_metadata (business_id,product_id,gender) values (9,9,'invented')")) !== null, 'metadata: invalid gender denied')
check((await fails_('service_role', null, "insert into public.product_gallery (business_id,product_id,image_url) values (7,19,'https://example.test/a.jpg')")) !== null, 'gallery: duplicate image denied')
check((await fails_('service_role', null, "insert into public.product_gallery (business_id,product_id,image_url) values (9,9,'javascript:alert(1)')")) !== null, 'gallery: unsafe URL denied')
await as('service_role', null, tx => tx.query("update public.product_metadata set brand='Updated' where business_id=7 and product_id=19"))
check((await db.query("select updated_at > created_at as bumped from public.product_metadata where business_id=7 and product_id=19")).rows[0].bumped, 'metadata: updated_at trigger')
check((await rows('anon', null, "select brand from public.product_metadata where business_id=8 and product_id=19"))[0].brand === 'B', 'metadata: same product ID across businesses remains distinct')
// Proposed overrides (20261017090000): Arabic name and curated size.
await as('service_role', null, tx => tx.query("update public.product_metadata set name_ar='عطر', size_ml=100 where business_id=7 and product_id=19"))
check((await rows('anon', null, "select name_ar, size_ml from public.product_metadata where business_id=7 and product_id=19"))[0]?.size_ml === 100, 'overrides: anon can read name_ar/size_ml')
check((await fails_('service_role', null, "update public.product_metadata set size_ml=0 where business_id=7")) !== null && (await fails_('service_role', null, "update public.product_metadata set name_ar='  ' where business_id=7")) !== null, 'overrides: invalid size or blank Arabic name denied')
check((await fails_('anon', null, "update public.product_metadata set name_ar='x'")) !== null, 'overrides: anon still cannot write')
let rerun = null
try { await db.exec(fs.readFileSync(path.join(MIGRATIONS, "20261017090000_product_metadata_overrides.sql"), "utf8")) } catch (e) { rerun = e.message }
check(rerun === null && (await db.query("select size_ml from public.product_metadata where business_id=7 and product_id=19")).rows[0].size_ml === 100, 'overrides: pasting the migration twice is harmless', rerun)
// ---------- Bag (20261019090000_cart_items) ----------
const [BA, BB, BC] = ["44444444-4444-4444-4444-444444444444", "55555555-5555-5555-5555-555555555555", "66666666-6666-6666-6666-666666666666"]
for (const id of [BA, BB, BC]) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, id.slice(0, 4) + "@example.com"])
const addLine = (uid, product, options, quantity = 1) =>
  rows('authenticated', uid, 'select * from public.add_cart_item(84116, $1, $2::bigint[], $3)', [product, options, quantity])
let line = (await addLine(BA, 14106, [12285]))[0]
check(line?.user_id === BA && line.quantity === 1 && line.option_ids.length === 1, 'bag: add creates a line owned by the session user', line)
line = (await addLine(BA, 14106, [12285], 2))[0]
check(line.quantity === 3, 'bag: same product + same option raises the quantity', line)
await addLine(BA, 14106, [12284])
await addLine(BA, 11868, [])
check((await rows('authenticated', BA, 'select * from public.cart_items')).length === 3, 'bag: different option and plain product are separate lines')
check((await addLine(BA, 11868, [], 20))[0].quantity === 10, 'bag: quantity capped at 10')
check((await rows('authenticated', BB, 'select * from public.cart_items')).length === 0, 'bag: B cannot read A\'s bag')
check((await rows('anon', null, 'select 1')).length === 1 && (await fails_('anon', null, 'select * from public.cart_items')) !== null, 'bag: anon cannot read bags')
check((await fails_('anon', null, 'select * from public.add_cart_item(84116, 1, \'{}\', 1)')) !== null, 'bag: anon cannot add')
check((await as('authenticated', BB, (tx) => tx.query('update public.cart_items set quantity=1'))).affectedRows === 0, 'bag: B cannot change A\'s quantities')
check((await as('authenticated', BB, (tx) => tx.query('delete from public.cart_items'))).affectedRows === 0, 'bag: B cannot delete A\'s lines')
check((await fails_('authenticated', BB, 'insert into public.cart_items (user_id, business_id, product_id, quantity) values ($1, 84116, 5, 1)', [BA])) !== null, 'bag: cannot insert into another user\'s bag')
check((await fails_('authenticated', BA, 'update public.cart_items set user_id=$1', [BB])) !== null, 'bag: cannot move a line to another user')
check((await fails_('authenticated', BA, 'update public.cart_items set product_id=1')) !== null, 'bag: only quantity can change')
check((await fails_('authenticated', BA, 'update public.cart_items set quantity=0')) !== null && (await fails_('authenticated', BA, 'update public.cart_items set quantity=11')) !== null, 'bag: quantity limited to 1..10')
check((await fails_('authenticated', BA, 'select * from public.add_cart_item(84116, 0, \'{}\', 1)')) !== null && (await fails_('authenticated', BA, 'select * from public.add_cart_item(84116, 5, \'{0}\', 1)')) !== null && (await fails_('authenticated', BA, 'select * from public.add_cart_item(84116, 5, \'{}\', 0)')) !== null, 'bag: invalid product, option or quantity rejected')
await as('authenticated', BA, (tx) => tx.query('update public.cart_items set quantity=4 where product_id=11868'))
check((await db.query('select quantity from public.cart_items where product_id=11868')).rows[0].quantity === 4, 'bag: owner updates quantity')
await addLine(BB, 11868, [])
await as('authenticated', BA, (tx) => tx.query('delete from public.cart_items where product_id=14106 and option_ids=$1::bigint[]', [[12284]]))
check((await rows('authenticated', BA, 'select * from public.cart_items')).length === 2, 'bag: owner removes one line')
await as('authenticated', BA, (tx) => tx.query('delete from public.cart_items where business_id=84116'))
check((await rows('authenticated', BA, 'select * from public.cart_items')).length === 0 && (await rows('authenticated', BB, 'select * from public.cart_items')).length === 1, 'bag: clearing A\'s bag leaves B\'s bag')
for (let i = 1; i <= 50; i++) await addLine(BC, i, [])
check((await fails_('authenticated', BC, 'select * from public.add_cart_item(84116, 51, \'{}\', 1)'))?.includes('cart_limit_reached'), 'bag: at most 50 lines')
check((await addLine(BC, 50, [], 1))[0].quantity === 2, 'bag: a full bag can still raise an existing line')

// ---------- Anonymous guests (20261020090000_anonymous_guests) ----------
const G = "77777777-7777-7777-7777-777777777777"
const OLD_G = "88888888-8888-8888-8888-888888888888"
const CUST = "99999999-9999-9999-9999-999999999999"
await db.query("insert into auth.users (id, email, is_anonymous) values ($1, null, true)", [G])
await db.query("insert into auth.users (id, email, is_anonymous, created_at) values ($1, null, true, now() - interval '40 days')", [OLD_G])
await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'cust@example.com', '{\"first_name\":\"Cus\"}')", [CUST])
check((await db.query("select count(*)::int n from public.profiles where id in ($1, $2)", [G, OLD_G])).rows[0].n === 0, "guests: anonymous users get no profile")
check((await db.query("select first_name from public.profiles where id = $1", [CUST])).rows[0]?.first_name === "Cus", "guests: customers still get a profile")
/** Runs as an anonymous guest: authenticated role with the is_anonymous claim. */
async function asGuest(uid, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated")
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid])
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated", is_anonymous: true })])
    return tx.query(sql, params)
  })
}
const guestFails = async (sql, params) => { try { await asGuest(G, sql, params); return null } catch (e) { return e.message } }
const gLine = (await asGuest(G, "select * from public.add_cart_item(84116, 11868, '{}', 2)")).rows[0]
check(gLine?.user_id === G && gLine.quantity === 2, "guests: bag line saved under the guest's own id", gLine)
check((await asGuest(G, "select * from public.add_cart_item(84116, 14106, '{12285}', 1)")).rows[0]?.option_ids?.length === 1, "guests: option line saved")
check((await asGuest(G, "select product_id from public.cart_items")).rows.length === 2, "guests: guest reads own bag")
await asGuest(G, "update public.cart_items set quantity = 3 where product_id = 11868")
check((await db.query("select quantity from public.cart_items where user_id = $1 and product_id = 11868", [G])).rows[0].quantity === 3, "guests: guest updates own quantity")
check((await rows("authenticated", CUST, "select * from public.cart_items")).length === 0, "guests: a customer cannot read a guest's bag")
check((await asGuest(G, "select * from public.cart_items where user_id <> $1", [G])).rows.length === 0, "guests: a guest cannot read other bags")
check((await asGuest(G, "select * from public.profiles")).rows.length === 0, "guests: no profile rows visible")
check((await guestFails("insert into public.profiles (id, first_name) values ($1, 'x')", [G])) !== null, "guests: cannot create a profile")
check((await guestFails("insert into public.addresses (full_name, phone, address, city_area) values ('a','1','b','c')")) !== null, "guests: cannot save an address")
check((await asGuest(G, "select * from public.addresses")).rows.length === 0 && (await asGuest(G, "select * from public.orders")).rows.length === 0 && (await asGuest(G, "select * from public.order_items")).rows.length === 0, "guests: no addresses, orders or order items visible")
check((await guestFails("select public.create_order_request($1::jsonb)", [JSON.stringify(request("PF-GUEST-0001"))]))?.includes("anonymous_not_allowed"), "guests: create_order_request refused for a guest")
check((await db.query("select count(*)::int n from public.orders where user_id = $1", [G])).rows[0].n === 0, "guests: no order row was created")
check((await rpc("authenticated", CUST, request("PF-CUST-0001")))[0]?.id, "guests: customers still create order requests")
check((await rows("authenticated", CUST, "select first_name from public.profiles")).length === 1, "guests: customers still read their profile")
// Housekeeping
for (const role of ["anon", "authenticated"])
  check((await fails_(role, null, "select public.delete_stale_anonymous_users(30)")) !== null, "guests: " + role + " cannot run the cleanup")
await db.query("insert into public.cart_items (user_id, business_id, product_id, quantity) values ($1, 84116, 1, 1)", [OLD_G])
const removedGuests = (await db.query("select public.delete_stale_anonymous_users(30) as n")).rows[0].n
check(removedGuests === 1, "guests: cleanup removes only anonymous users older than 30 days", removedGuests)
check((await db.query("select count(*)::int n from public.cart_items where user_id = $1", [OLD_G])).rows[0].n === 0, "guests: their bag rows go with them")
check((await db.query("select count(*)::int n from auth.users where id in ($1, $2)", [G, CUST])).rows[0].n === 2, "guests: recent guests and customers are kept")
check(String(await db.query("select public.delete_stale_anonymous_users(0) as n").then(() => "ran", (e) => e.message)).includes("invalid_days"), "guests: cleanup rejects 0 days")
await db.close()
report.finish()
