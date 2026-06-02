ALTER TABLE public.research_reports
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_latest boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_research_reports_ticker_version
  ON public.research_reports (ticker, version DESC);

CREATE INDEX IF NOT EXISTS idx_research_reports_ticker_latest
  ON public.research_reports (ticker) WHERE is_latest;