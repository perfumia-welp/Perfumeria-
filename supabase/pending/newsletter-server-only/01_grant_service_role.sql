-- NOT APPLIED. Step 1 of 2: newsletter sign-up through the website server only.
-- See README.md in this folder for the order and the checks between steps.
--
-- Lets the server's service role call subscribe_newsletter(). Changes nothing
-- for website visitors: anon and authenticated keep their grant until step 2,
-- so the live sign-up keeps working whichever key the server uses.
-- Safe to run more than once.

begin;

grant execute on function public.subscribe_newsletter(text, text, text) to service_role;

commit;
