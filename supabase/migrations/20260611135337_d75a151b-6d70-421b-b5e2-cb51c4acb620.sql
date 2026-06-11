CREATE POLICY "anon_insert" ON vault_notes_meta FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update" ON vault_notes_meta FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_delete" ON vault_backlinks FOR DELETE TO anon USING (true);

CREATE POLICY "anon_insert" ON vault_backlinks FOR INSERT TO anon WITH CHECK (true);