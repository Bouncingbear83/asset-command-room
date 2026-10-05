ALTER TABLE public.score_rationales DROP CONSTRAINT score_rationales_factor_primary_check;

ALTER TABLE public.score_rationales ADD CONSTRAINT score_rationales_factor_primary_check
CHECK (
  factor_primary IS NULL
  OR factor_primary = ANY (ARRAY[
    'SEMI_CAPEX'::text,
    'DEFENCE_BUDGET'::text,
    'ENERGY_INFRA'::text,
    'COMMODITY_SUPER'::text,
    'BIOTECH_FUNDING'::text,
    'ROBOTICS_CAPEX'::text,
    'URANIUM_SPOT'::text,
    'GOLD_RATES'::text,
    'MACRO_DECORR'::text,
    'CRITICAL_MINERALS'::text
  ])
);