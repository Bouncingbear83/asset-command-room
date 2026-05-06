CREATE INDEX IF NOT EXISTS idx_hs_factor_group ON public.holdings_snapshot(factor_group);
CREATE INDEX IF NOT EXISTS idx_hs_stack_layer ON public.holdings_snapshot(stack_layer);

ALTER TABLE public.scores_snapshot
  ADD COLUMN IF NOT EXISTS substrate_level text,
  ADD COLUMN IF NOT EXISTS stack_layer text;

ALTER TABLE public.factor_group_weights
  ADD COLUMN IF NOT EXISTS priority text;

CREATE INDEX IF NOT EXISTS idx_fgw_priority
  ON public.factor_group_weights(priority)
  WHERE priority <> 'OK';