CREATE OR REPLACE VIEW public.scores_latest
WITH (security_invoker = true) AS
SELECT DISTINCT ON (s.ticker) s.*
FROM public.scores_snapshot s
ORDER BY s.ticker, s.snapshot_date DESC, s.id DESC;

GRANT SELECT ON public.scores_latest TO anon, authenticated;
GRANT ALL ON public.scores_latest TO service_role;