CREATE TABLE public.research_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL,
  name TEXT,
  layer TEXT,
  score INTEGER,
  tier TEXT,
  reclass_status TEXT,
  report_date DATE NOT NULL,
  report_html TEXT NOT NULL,
  summary TEXT,
  prob_weighted_ev NUMERIC(6,2),
  spot_at_report NUMERIC(8,2),
  quartet_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT ON public.research_reports TO anon;
GRANT SELECT ON public.research_reports TO authenticated;
GRANT ALL ON public.research_reports TO service_role;

CREATE UNIQUE INDEX idx_reports_ticker_date ON public.research_reports (ticker, report_date);
CREATE INDEX idx_reports_ticker ON public.research_reports (ticker);
CREATE INDEX idx_reports_layer ON public.research_reports (layer);

ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read" ON public.research_reports
  FOR SELECT USING (true);

CREATE POLICY "Allow service write" ON public.research_reports
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.update_research_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reports_updated
  BEFORE UPDATE ON public.research_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_research_reports_updated_at();