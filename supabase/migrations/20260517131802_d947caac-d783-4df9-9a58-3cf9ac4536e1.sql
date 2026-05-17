ALTER TABLE public.score_rationales
  ADD COLUMN IF NOT EXISTS bull_case           text,
  ADD COLUMN IF NOT EXISTS bear_case           text,
  ADD COLUMN IF NOT EXISTS asymmetry_ratio     text,
  ADD COLUMN IF NOT EXISTS stage2_subclass     text,
  ADD COLUMN IF NOT EXISTS china_exposure_flag text,
  ADD COLUMN IF NOT EXISTS price_at_first_add  numeric,
  ADD COLUMN IF NOT EXISTS first_add_date      date,
  ADD COLUMN IF NOT EXISTS price_at_last_score numeric;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'score_rationales_ticker_scored_at_key'
  ) THEN
    ALTER TABLE public.score_rationales
      ADD CONSTRAINT score_rationales_ticker_scored_at_key UNIQUE (ticker, scored_at);
  END IF;
END $$;