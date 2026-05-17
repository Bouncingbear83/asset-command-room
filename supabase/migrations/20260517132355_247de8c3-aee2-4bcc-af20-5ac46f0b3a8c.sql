DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'disruption_rationales_ticker_scored_at_key'
  ) THEN
    ALTER TABLE public.disruption_rationales
      ADD CONSTRAINT disruption_rationales_ticker_scored_at_key
      UNIQUE (ticker, scored_at);
  END IF;
END $$;