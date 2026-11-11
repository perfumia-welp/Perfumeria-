# Newsletter sign-up through the server only (NOT APPLIED)

These SQL files sit outside `supabase/migrations/` on purpose: nothing applies
them automatically. Each one needs the owner's approval.

## Why

`subscribe_newsletter()` (migration `20261022120000`) is granted to `anon`, so
anyone can call it with the public Supabase key that every browser has. That:

- skips the rate limit on `POST /api/newsletter`;
- answers `subscribed` or `already_subscribed`, so it shows whether an address
  is on the list;
- puts an address that unsubscribed back on the list.

The website itself no longer reveals the difference: `POST /api/newsletter`
answers `{ "ok": true }` in both cases. Only the direct database call still
does, until step 2.

## Order (each step keeps the live form working)

1. **Apply `01_grant_service_role.sql`** (SQL editor). It only adds a grant, and
   visitors are unaffected.
2. **Set `SUPABASE_SERVICE_ROLE_KEY`** in Hostinger's environment variables for
   the Node.js app. Use the service role key or an `sb_secret_…` key. It must
   never have a `VITE_` prefix. Redeploy or restart.
3. **Check the startup log** says `newsletter on (server key)`.
4. **Test one sign-up** through the website footer with an address you own.
   It should show the success message. In the dashboard, the row is in
   `newsletter_subscribers`.
5. **Apply `02_revoke_public_access.sql`**.
6. **Check** that a direct call with the public key is refused:

   ```sh
   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/subscribe_newsletter" \
     -H "apikey: $PUBLISHABLE_KEY" -H "Content-Type: application/json" \
     -d '{"p_email":"not-an-email"}'
   ```

   Before step 5 this answers `22023 invalid_email` (the function ran). After
   it, the answer is `42501 permission denied`. The invalid address means
   nothing is written either way.

If step 4 fails, do not run step 5. Removing the key (step 2) puts the server
back on the public key.

## Not changed: unsubscribed addresses

After step 5 an unsubscribed address can still be re-subscribed, but only
through the website form, which is rate limited. The form already lets anyone
add any address, because there is no confirmation email. Two options for the
owner:

- keep `unsubscribed` rows as they are, and still answer `{ ok: true }`;
- add a confirmation email (double opt-in).

Neither is in these files.

## Shared variable

`SUPABASE_SERVICE_ROLE_KEY` is the same variable the server-verified orders
work (not yet released) needs. Once it is set, the newsletter starts using it
automatically, which is why step 1 comes first.
