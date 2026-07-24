
-- 1. Enable RLS on position_reference and add anon SELECT
ALTER TABLE public.position_reference ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.position_reference TO anon, authenticated;
GRANT ALL ON public.position_reference TO service_role;
DROP POLICY IF EXISTS "position_reference_anon_read" ON public.position_reference;
CREATE POLICY "position_reference_anon_read" ON public.position_reference FOR SELECT USING (true);

-- 2. Lock down action_tracker writes to service_role only
DROP POLICY IF EXISTS action_tracker_all_insert ON public.action_tracker;
DROP POLICY IF EXISTS action_tracker_all_update ON public.action_tracker;
DROP POLICY IF EXISTS action_tracker_all_delete ON public.action_tracker;
REVOKE INSERT, UPDATE, DELETE ON public.action_tracker FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.action_tracker TO service_role;

-- 3. Fix search_path on flagged functions
ALTER FUNCTION public.perf_by_dimension_window(text, integer) SET search_path = public;
ALTER FUNCTION public.capital_flows_by_dimension(text, integer) SET search_path = public;
ALTER FUNCTION public.upsert_position_reference(text, numeric, numeric, date, text, text) SET search_path = public;
