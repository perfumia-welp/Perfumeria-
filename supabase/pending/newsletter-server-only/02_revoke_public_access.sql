-- NOT APPLIED. Step 2 of 2: newsletter sign-up through the website server only.
-- Run ONLY after the server log says "newsletter on (server key)" and a test
-- sign-up through the website has worked (README.md in this folder).
--
-- Closes subscribe_newsletter() to website visitors. Afterwards nobody can call
-- it with the public key, so nobody can skip the server's rate limit or ask
-- the database directly whether an address is subscribed. The server's
-- service role keeps its grant from step 1.
--
-- Undo (reopens the old direct access):
--   grant execute on function public.subscribe_newsletter(text, text, text) to anon, authenticated;

begin;

revoke execute on function public.subscribe_newsletter(text, text, text) from public, anon, authenticated;
grant execute on function public.subscribe_newsletter(text, text, text) to service_role;

commit;
