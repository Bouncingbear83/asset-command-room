REVOKE EXECUTE ON FUNCTION public.upsert_watchlist_prices(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_watchlist_prices(jsonb) TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.watchlist_price_history FROM anon, authenticated;
GRANT SELECT ON public.watchlist_price_history TO anon, authenticated;
GRANT ALL ON public.watchlist_price_history TO service_role;