CREATE OR REPLACE FUNCTION public.upsert_watchlist_prices(prices jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_count integer;
BEGIN
  INSERT INTO public.watchlist_price_history (ticker, snapshot_date, close_price, currency, source)
  SELECT
    (r->>'ticker')::text,
    (r->>'snapshot_date')::date,
    (r->>'close_price')::numeric,
    (r->>'currency')::text,
    (r->>'source')::text
  FROM jsonb_array_elements(prices) AS r
  ON CONFLICT (ticker, snapshot_date)
  DO UPDATE SET
    close_price = EXCLUDED.close_price,
    currency = EXCLUDED.currency,
    source = EXCLUDED.source;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN row_count;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_watchlist_prices(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_watchlist_prices(jsonb) TO service_role;