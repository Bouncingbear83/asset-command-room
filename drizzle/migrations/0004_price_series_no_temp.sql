CREATE OR REPLACE FUNCTION public.get_price_series(p_ticker text, p_days integer DEFAULT 365, p_max_points integer DEFAULT 500)
RETURNS TABLE(date date, close numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH s AS (
    SELECT w.snapshot_date d, w.close_price c FROM watchlist_price_history w
    WHERE upper(trim(w.ticker)) = upper(trim(p_ticker))
      AND extract(isodow FROM w.snapshot_date) < 6
      AND (COALESCE(p_days, 0) = 0 OR w.snapshot_date >= current_date - p_days)
  ),
  mode AS (
    SELECT CASE
      WHEN (SELECT count(*) FROM s) <= p_max_points THEN 'day'
      WHEN (SELECT count(DISTINCT date_trunc('week', d)) FROM s) <= p_max_points THEN 'week'
      ELSE 'month' END AS m
  ),
  b AS (
    SELECT d, c, CASE (SELECT m FROM mode) WHEN 'day' THEN d::timestamp ELSE date_trunc((SELECT m FROM mode), d) END AS k FROM s
  )
  SELECT x.d, x.c FROM (SELECT DISTINCT ON (k) d, c FROM b ORDER BY k, d DESC) x ORDER BY x.d;
$$;
GRANT EXECUTE ON FUNCTION public.get_price_series(text, integer, integer) TO authenticated, service_role;