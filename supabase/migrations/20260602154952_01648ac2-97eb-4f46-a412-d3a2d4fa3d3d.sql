CREATE UNIQUE INDEX IF NOT EXISTS research_reports_one_latest_per_ticker
  ON public.research_reports (ticker)
  WHERE is_latest = true;