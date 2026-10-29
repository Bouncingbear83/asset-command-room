CREATE OR REPLACE FUNCTION public.get_price_trajectories(p_tickers text[])
RETURNS TABLE(ticker text, currency text, spark30d jsonb, current_close numeric, price_7d_ago numeric, price_30d_ago numeric, high_52w numeric, low_52w numeric, first_date date, last_date date, row_count integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH req AS (SELECT DISTINCT upper(trim(t)) AS t FROM unnest(p_tickers) t),
  h AS (
    SELECT upper(trim(w.ticker)) AS t, w.snapshot_date d, w.close_price c, w.currency cur
    FROM watchlist_price_history w
    WHERE upper(trim(w.ticker)) IN (SELECT t FROM req)
      AND extract(isodow FROM w.snapshot_date) < 6
  )
  SELECT r.t,
    (SELECT cur FROM h WHERE h.t = r.t ORDER BY d DESC LIMIT 1),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d, 'close', c) ORDER BY d) FROM h WHERE h.t = r.t AND d >= current_date - 30), '[]'::jsonb),
    (SELECT c FROM h WHERE h.t = r.t ORDER BY d DESC LIMIT 1),
    (SELECT c FROM h WHERE h.t = r.t AND d <= current_date - 7 ORDER BY d DESC LIMIT 1),
    (SELECT c FROM h WHERE h.t = r.t AND d <= current_date - 30 ORDER BY d DESC LIMIT 1),
    (SELECT max(c) FROM h WHERE h.t = r.t AND d >= current_date - 365),
    (SELECT min(c) FROM h WHERE h.t = r.t AND d >= current_date - 365),
    (SELECT min(d) FROM h WHERE h.t = r.t),
    (SELECT max(d) FROM h WHERE h.t = r.t),
    (SELECT count(*)::int FROM h WHERE h.t = r.t)
  FROM req r
  WHERE EXISTS (SELECT 1 FROM h WHERE h.t = r.t);
$$;

CREATE OR REPLACE FUNCTION public.get_price_series(p_ticker text, p_days integer DEFAULT 365, p_max_points integer DEFAULT 500)
RETURNS TABLE(date date, close numeric)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _ps(d date, c numeric) ON COMMIT DROP;
  DELETE FROM _ps;
  INSERT INTO _ps
    SELECT w.snapshot_date, w.close_price FROM watchlist_price_history w
    WHERE upper(trim(w.ticker)) = upper(trim(p_ticker))
      AND extract(isodow FROM w.snapshot_date) < 6
      AND (COALESCE(p_days, 0) = 0 OR w.snapshot_date >= current_date - p_days);
  SELECT count(*) INTO n FROM _ps;
  IF n <= p_max_points THEN
    RETURN QUERY SELECT d, c FROM _ps ORDER BY d;
    RETURN;
  END IF;
  SELECT count(DISTINCT date_trunc('week', d)) INTO n FROM _ps;
  IF n <= p_max_points THEN
    RETURN QUERY SELECT DISTINCT ON (date_trunc('week', d)) d, c FROM _ps ORDER BY date_trunc('week', d), d DESC;
    RETURN;
  END IF;
  RETURN QUERY SELECT x.d, x.c FROM (SELECT DISTINCT ON (date_trunc('month', d)) d, c FROM _ps ORDER BY date_trunc('month', d), d DESC) x ORDER BY x.d;
END;
$$;

REVOKE ALL ON FUNCTION public.get_price_trajectories(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_price_series(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_price_trajectories(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_price_series(text, integer, integer) TO authenticated, service_role;

CREATE TABLE public.price_symbol_map (
  ticker text PRIMARY KEY,
  yahoo_symbol text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PRIVATE','UNRESOLVED')),
  note text,
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.price_symbol_map TO authenticated;
GRANT ALL ON public.price_symbol_map TO service_role;
ALTER TABLE public.price_symbol_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_select ON public.price_symbol_map FOR SELECT TO authenticated USING ((auth.jwt() ->> 'email') = 'bertbroadhead@gmail.com');
INSERT INTO public.price_symbol_map (ticker, yahoo_symbol, status) VALUES
 ('NSISB.CO','NSIS-B.CO','ACTIVE'), ('ANDURIL',null,'PRIVATE'), ('SHIELD AI',null,'PRIVATE'), ('VARDA',null,'PRIVATE'),
 ('BCR',null,'UNRESOLVED'), ('VVDY',null,'UNRESOLVED'), ('KODT.ZA',null,'UNRESOLVED')
ON CONFLICT (ticker) DO NOTHING;

CREATE VIEW public.v_price_history_coverage WITH (security_invoker = true) AS
SELECT upper(trim(w.ticker)) AS ticker, min(w.snapshot_date) AS first_date, max(w.snapshot_date) AS last_date,
  count(*)::int AS row_count, (current_date - max(w.snapshot_date))::int AS stale_days,
  COALESCE(max(m.status), 'ACTIVE') AS status
FROM public.watchlist_price_history w
LEFT JOIN public.price_symbol_map m ON upper(trim(m.ticker)) = upper(trim(w.ticker))
WHERE extract(isodow FROM w.snapshot_date) < 6
GROUP BY upper(trim(w.ticker));
GRANT SELECT ON public.v_price_history_coverage TO authenticated, service_role;