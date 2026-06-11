-- Remove anonymous UPDATE access on narrative_signals
-- Backend service_role already has full access via existing policy
DROP POLICY IF EXISTS "Anon can update narrative_signals review" ON narrative_signals;