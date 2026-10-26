ALTER TABLE public.action_tracker ADD COLUMN IF NOT EXISTS apply_target text NULL;
ALTER TABLE public.action_tracker ADD COLUMN IF NOT EXISTS staged_payload jsonb NULL;
ALTER TABLE public.action_tracker ADD CONSTRAINT action_tracker_apply_target_check CHECK (apply_target IN ('UPDATE_ROW','RC_QUEUE','TRADE_TICKET','NONE'));
ALTER TABLE public.action_tracker ADD CONSTRAINT action_tracker_staged_payload_check CHECK (staged_payload IS NULL OR (jsonb_typeof(staged_payload) = 'object' AND octet_length(staged_payload::text) <= 32768));
ALTER TABLE public.action_tracker ADD CONSTRAINT staged_pair CHECK ((apply_target IS NULL) = (staged_payload IS NULL));
CREATE INDEX IF NOT EXISTS action_tracker_open_apply_target_idx ON public.action_tracker (apply_target) WHERE status = 'OPEN' AND apply_target IS NOT NULL;