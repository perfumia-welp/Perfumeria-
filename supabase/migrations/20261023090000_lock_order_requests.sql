-- Lock order requests to the verified path
--
-- Apply AFTER the Node release with /api/orders is live and its smoke test
-- has passed. Until then the checkout already in production still calls
-- create_order_request() from the browser; revoking it earlier would break
-- that checkout's history save.
--
-- Afterwards no website role can write an order with its own prices: orders
-- arrive only through store_verified_order() (service role, Node server),
-- which still calls create_order_request() as the function owner.
--
-- Rollback (only together with rolling the site back to the old checkout):
--   grant execute on function public.create_order_request(jsonb) to authenticated;

begin;

revoke execute on function public.create_order_request(jsonb) from public, anon, authenticated;

commit;
