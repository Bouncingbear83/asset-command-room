CREATE INDEX IF NOT EXISTS watchlist_price_history_uticker_date_idx ON public.watchlist_price_history ((upper(trim(ticker))), snapshot_date);

CREATE OR REPLACE FUNCTION public.get_price_trajectories(p_tickers text[])
RETURNS TABLE(ticker text, currency text, spark30d jsonb, current_close numeric, price_7d_ago numeric, price_30d_ago numeric, high_52w numeric, low_52w numeric, first_date date, last_date date, row_count integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH h AS (
    SELECT upper(trim(w.ticker)) AS t, w.snapshot_date d, w.close_price c, w.currency cur
    FROM watchlist_price_history w
    WHERE upper(trim(w.ticker)) = ANY (SELECT upper(trim(x)) FROM unnest(p_tickers) x)
      AND extract(isodow FROM w.snapshot_date) < 6
  )
  SELECT t,
    (array_agg(cur ORDER BY d DESC))[1],
    COALESCE(jsonb_agg(jsonb_build_object('date', d, 'close', c) ORDER BY d) FILTER (WHERE d >= current_date - 30), '[]'::jsonb),
    (array_agg(c ORDER BY d DESC))[1],
    (array_agg(c ORDER BY d DESC) FILTER (WHERE d <= current_date - 7))[1],
    (array_agg(c ORDER BY d DESC) FILTER (WHERE d <= current_date - 30))[1],
    max(c) FILTER (WHERE d >= current_date - 365),
    min(c) FILTER (WHERE d >= current_date - 365),
    min(d), max(d), count(*)::int
  FROM h GROUP BY t;
$$;
GRANT EXECUTE ON FUNCTION public.get_price_trajectories(text[]) TO authenticated, service_role;