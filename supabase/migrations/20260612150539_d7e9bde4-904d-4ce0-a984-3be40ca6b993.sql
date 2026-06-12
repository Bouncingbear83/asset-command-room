ALTER TABLE vault_notes_meta
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(identifier, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(
      (frontmatter->>'ticker')::text, ''
    )), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_vault_notes_fts ON vault_notes_meta USING gin(fts);