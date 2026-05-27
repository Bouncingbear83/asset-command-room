ALTER TABLE public.scores_snapshot
  ADD COLUMN IF NOT EXISTS bull_base numeric,
  ADD COLUMN IF NOT EXISTS bull_stretch numeric,
  ADD COLUMN IF NOT EXISTS bear_thesis_weak numeric,
  ADD COLUMN IF NOT EXISTS bear_substrate_fail numeric,
  ADD COLUMN IF NOT EXISTS bull_bear_at_date date;

CREATE TABLE IF NOT EXISTS public.asymmetry_snapshot (
  id bigserial PRIMARY KEY,
  ticker text NOT NULL,
  snapshot_date date NOT NULL,
  bull_base numeric,
  bull_stretch numeric,
  bear_thesis_weak numeric,
  bear_substrate_fail numeric,
  bull_bear_at_date date,
  bull_implied_pct numeric,
  bear_floor_pct numeric,
  price_at_last_score numeric,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.asymmetry_snapshot TO anon, authenticated;
GRANT ALL ON public.asymmetry_snapshot TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.asymmetry_snapshot_id_seq TO service_role;

ALTER TABLE public.asymmetry_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read asymmetry_snapshot"
  ON public.asymmetry_snapshot FOR SELECT TO anon USING (true);

CREATE POLICY "Authenticated can read asymmetry_snapshot"
  ON public.asymmetry_snapshot FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_asymmetry_snapshot_ticker
  ON public.asymmetry_snapshot (ticker);
CREATE INDEX IF NOT EXISTS idx_asymmetry_snapshot_date
  ON public.asymmetry_snapshot (snapshot_date);