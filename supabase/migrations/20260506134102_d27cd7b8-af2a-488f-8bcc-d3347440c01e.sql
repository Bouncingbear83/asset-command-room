ALTER TABLE public.holdings_snapshot
  ADD COLUMN IF NOT EXISTS factor_primary text,
  ADD COLUMN IF NOT EXISTS factor_group text,
  ADD COLUMN IF NOT EXISTS stack_layer text,
  ADD COLUMN IF NOT EXISTS substrate_level text;

CREATE TABLE IF NOT EXISTS public.factor_group_weights (
  id bigserial PRIMARY KEY,
  factor_group text NOT NULL,
  snapshot_date date NOT NULL,
  current_pct numeric(6,2),
  mv_gbp numeric(14,2),
  source text DEFAULT 'sheets',
  created_at timestamptz DEFAULT now(),
  UNIQUE (factor_group, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_fgw_date ON public.factor_group_weights(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_fgw_group ON public.factor_group_weights(factor_group);

ALTER TABLE public.factor_group_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read factor_group_weights"
  ON public.factor_group_weights
  FOR SELECT
  TO authenticated
  USING (true);