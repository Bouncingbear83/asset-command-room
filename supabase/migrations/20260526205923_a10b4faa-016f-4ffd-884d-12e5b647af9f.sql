ALTER TABLE public.scores_snapshot ADD COLUMN IF NOT EXISTS substrate_stage text;
ALTER TABLE public.holdings_snapshot ADD COLUMN IF NOT EXISTS substrate_stage text;