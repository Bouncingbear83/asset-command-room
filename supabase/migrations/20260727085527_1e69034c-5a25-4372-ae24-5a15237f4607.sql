GRANT INSERT, UPDATE ON public.vault_notes_meta TO anon, authenticated;

DROP POLICY IF EXISTS "anon_insert" ON public.vault_notes_meta;
DROP POLICY IF EXISTS "anon_update" ON public.vault_notes_meta;

CREATE POLICY "anon_insert" ON public.vault_notes_meta
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon_update" ON public.vault_notes_meta
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);