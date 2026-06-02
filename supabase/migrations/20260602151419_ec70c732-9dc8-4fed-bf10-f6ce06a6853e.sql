DELETE FROM public.research_reports WHERE report_date = '2026-06-02';

-- Re-number any remaining duplicates by report_date ascending
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY ticker ORDER BY report_date, created_at) AS rn,
         max(report_date) OVER (PARTITION BY ticker) AS max_date,
         report_date
  FROM public.research_reports
)
UPDATE public.research_reports r
SET version = ranked.rn,
    is_latest = (ranked.report_date = ranked.max_date)
FROM ranked
WHERE r.id = ranked.id;

ALTER TABLE public.research_reports 
  ADD CONSTRAINT research_reports_ticker_version_key UNIQUE (ticker, version);

CREATE INDEX IF NOT EXISTS idx_research_reports_latest 
  ON public.research_reports (ticker, is_latest) 
  WHERE is_latest = true;