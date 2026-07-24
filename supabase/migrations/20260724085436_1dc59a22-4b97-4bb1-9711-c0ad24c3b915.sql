
DROP POLICY IF EXISTS "service_role_insert" ON public.action_tracker;
DROP POLICY IF EXISTS "service_role_update" ON public.action_tracker;
DROP POLICY IF EXISTS "service_role_delete" ON public.action_tracker;
DROP POLICY IF EXISTS "service_role_all" ON public.action_tracker;
DROP POLICY IF EXISTS "anon_insert" ON public.action_tracker;
DROP POLICY IF EXISTS "anon_update" ON public.action_tracker;
DROP POLICY IF EXISTS "anon_delete" ON public.action_tracker;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_tracker TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_tracker TO authenticated;
GRANT ALL ON public.action_tracker TO service_role;

CREATE POLICY "anon_insert" ON public.action_tracker FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update" ON public.action_tracker FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete" ON public.action_tracker FOR DELETE TO anon USING (true);
