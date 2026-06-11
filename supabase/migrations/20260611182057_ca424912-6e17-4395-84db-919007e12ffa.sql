-- Lock down vault_notes_meta: public read only, service_role full access
DROP POLICY IF EXISTS "Allow all" ON vault_notes_meta;
DROP POLICY IF EXISTS "anon_insert" ON vault_notes_meta;
DROP POLICY IF EXISTS "anon_update" ON vault_notes_meta;
DROP POLICY IF EXISTS "anon_delete" ON vault_notes_meta;

CREATE POLICY "Vault notes meta service_role full access"
  ON vault_notes_meta
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Lock down vault_backlinks: public read only, service_role full access
DROP POLICY IF EXISTS "Allow all" ON vault_backlinks;
DROP POLICY IF EXISTS "anon_insert" ON vault_backlinks;
DROP POLICY IF EXISTS "anon_delete" ON vault_backlinks;

CREATE POLICY "Vault backlinks service_role full access"
  ON vault_backlinks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);