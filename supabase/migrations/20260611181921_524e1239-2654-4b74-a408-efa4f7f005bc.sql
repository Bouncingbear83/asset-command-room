ALTER TABLE vault_notes_meta
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS body_sections JSONB;

CREATE INDEX IF NOT EXISTS idx_vnm_type_identifier
  ON vault_notes_meta(type, identifier);

COMMENT ON COLUMN vault_notes_meta.body IS 'Markdown body with frontmatter stripped. Populated by nightly indexer.';
COMMENT ON COLUMN vault_notes_meta.body_sections IS 'H2 sections parsed as {"section_title": "content"}. Enables targeted content pulls.';