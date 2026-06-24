ALTER TABLE public.scores_snapshot
  ADD COLUMN IF NOT EXISTS bb_target_date TEXT,
  ADD COLUMN IF NOT EXISTS div_yield NUMERIC;