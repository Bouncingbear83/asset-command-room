CREATE TABLE public.layer_review_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  layer TEXT NOT NULL,
  cycle TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  completed_date DATE,
  session_vault_path TEXT,
  review_vault_path TEXT,
  open_trends INTEGER DEFAULT 0,
  action_items JSON DEFAULT '[]',
  prompt_template TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETE', 'SKIPPED'))
);

CREATE INDEX idx_lrs_cycle ON layer_review_schedule(cycle);
CREATE INDEX idx_lrs_status ON layer_review_schedule(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.layer_review_schedule TO authenticated;
GRANT ALL ON public.layer_review_schedule TO service_role;

ALTER TABLE public.layer_review_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage layer reviews"
  ON public.layer_review_schedule
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_layer_review_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_layer_review_schedule_updated_at
  BEFORE UPDATE ON public.layer_review_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.update_layer_review_updated_at();