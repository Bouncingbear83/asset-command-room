
CREATE TABLE public.action_tracker (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT,
  action_type TEXT NOT NULL,
  due_date DATE NOT NULL,
  summary TEXT NOT NULL,
  context TEXT,
  source TEXT,
  source_session TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  dedupe_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_tracker TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_tracker TO authenticated;
GRANT ALL ON public.action_tracker TO service_role;

ALTER TABLE public.action_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_tracker_all_read" ON public.action_tracker FOR SELECT USING (true);
CREATE POLICY "action_tracker_all_insert" ON public.action_tracker FOR INSERT WITH CHECK (true);
CREATE POLICY "action_tracker_all_update" ON public.action_tracker FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "action_tracker_all_delete" ON public.action_tracker FOR DELETE USING (true);

CREATE INDEX action_tracker_due_date_idx ON public.action_tracker(due_date);
CREATE INDEX action_tracker_status_idx ON public.action_tracker(status);

CREATE TRIGGER update_action_tracker_updated_at
  BEFORE UPDATE ON public.action_tracker
  FOR EACH ROW EXECUTE FUNCTION public.update_scheduled_reviews_updated_at();
