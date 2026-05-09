ALTER TABLE public.score_rationales
  ADD COLUMN IF NOT EXISTS factor_group TEXT,
  ADD COLUMN IF NOT EXISTS factor_primary TEXT;

ALTER TABLE public.score_rationales
  DROP CONSTRAINT IF EXISTS score_rationales_factor_group_check;
ALTER TABLE public.score_rationales
  ADD CONSTRAINT score_rationales_factor_group_check
  CHECK (factor_group IS NULL OR factor_group IN (
    'AI_INFRA', 'GENOMICS_BIO', 'ENERGY_TRANSITION', 'SOVEREIGNTY',
    'ROBOTICS_AUTOMATION', 'MACRO_HEDGE', 'AGRI_INPUTS'
  ));

ALTER TABLE public.score_rationales
  DROP CONSTRAINT IF EXISTS score_rationales_factor_primary_check;
ALTER TABLE public.score_rationales
  ADD CONSTRAINT score_rationales_factor_primary_check
  CHECK (factor_primary IS NULL OR factor_primary IN (
    'SEMI_CAPEX', 'DEFENCE_BUDGET', 'ENERGY_INFRA', 'COMMODITY_SUPER',
    'BIOTECH_FUNDING', 'ROBOTICS_CAPEX', 'URANIUM_SPOT', 'GOLD_RATES',
    'MACRO_DECORR'
  ));

CREATE INDEX IF NOT EXISTS idx_score_rationales_factor_group
  ON public.score_rationales(factor_group);

CREATE INDEX IF NOT EXISTS idx_score_rationales_factor_primary
  ON public.score_rationales(factor_primary);

NOTIFY pgrst, 'reload schema';