ALTER TABLE public.scores_snapshot ADD COLUMN IF NOT EXISTS stellar_type text;
ALTER TABLE public.scores_snapshot ADD COLUMN IF NOT EXISTS reject_reason text;