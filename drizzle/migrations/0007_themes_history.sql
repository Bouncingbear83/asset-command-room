CREATE TABLE IF NOT EXISTS public.themes_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id text NOT NULL,
  from_stage text NULL,
  to_stage text NOT NULL,
  transition text NOT NULL,
  transitioned_on date NOT NULL,
  session_ref text NULL,
  sheet_row integer NULL,
  note text NULL,
  source text NOT NULL DEFAULT 'SESSION',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT themes_history_to_stage_check CHECK (to_stage IN ('SIGNAL','FORMING','MAPPED','ACTIVE','RETIRE')),
  CONSTRAINT themes_history_from_stage_check CHECK (from_stage IS NULL OR from_stage IN ('SIGNAL','FORMING','MAPPED','ACTIVE','RETIRE')),
  CONSTRAINT themes_history_transition_check CHECK (transition IN ('SEED','TP1','TP2','TP3','TP4','TP5','NOPIPE','REOPEN','DEMOTE')),
  CONSTRAINT themes_history_source_check CHECK (source IN ('SESSION','AUTO','BACKFILL')),
  CONSTRAINT themes_history_dedupe UNIQUE (theme_id, to_stage, transition, transitioned_on)
);
CREATE INDEX IF NOT EXISTS themes_history_theme_idx ON public.themes_history (theme_id, transitioned_on DESC);
ALTER TABLE public.themes_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.themes_history TO authenticated;
GRANT ALL ON TABLE public.themes_history TO service_role;
DROP POLICY IF EXISTS owner_select ON public.themes_history;
CREATE POLICY owner_select ON public.themes_history FOR SELECT TO authenticated USING ((auth.jwt() ->> 'email') = 'bertbroadhead@gmail.com');