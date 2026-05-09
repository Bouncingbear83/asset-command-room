ALTER TABLE public.score_rationales
  ADD COLUMN IF NOT EXISTS substrate_level TEXT,
  ADD COLUMN IF NOT EXISTS stack_layer TEXT,
  ADD COLUMN IF NOT EXISTS factor_group TEXT,
  ADD COLUMN IF NOT EXISTS factor_primary TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'score_rationales_substrate_level_check'
      AND conrelid = 'public.score_rationales'::regclass
  ) THEN
    ALTER TABLE public.score_rationales
      ADD CONSTRAINT score_rationales_substrate_level_check
      CHECK (substrate_level IS NULL OR substrate_level IN ('L1','L2','L3','L4'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'score_rationales_stack_layer_check'
      AND conrelid = 'public.score_rationales'::regclass
  ) THEN
    ALTER TABLE public.score_rationales
      ADD CONSTRAINT score_rationales_stack_layer_check
      CHECK (stack_layer IS NULL OR stack_layer IN (
        'COMPONENT','SUBSYSTEM','INTEGRATION','PROCESS_TOOLING','FOUNDRY','N/A'
      ));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';