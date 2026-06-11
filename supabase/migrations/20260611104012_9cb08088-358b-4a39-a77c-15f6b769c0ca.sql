
CREATE TABLE public.vault_notes_meta (
  path TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  identifier TEXT,
  title TEXT,
  frontmatter JSONB,
  last_indexed TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vnm_type ON public.vault_notes_meta(type);
CREATE INDEX idx_vnm_identifier ON public.vault_notes_meta(identifier);

GRANT SELECT ON public.vault_notes_meta TO anon, authenticated;
GRANT ALL ON public.vault_notes_meta TO service_role;

ALTER TABLE public.vault_notes_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vault notes meta readable by all"
  ON public.vault_notes_meta FOR SELECT
  USING (true);

CREATE TABLE public.vault_backlinks (
  id BIGSERIAL PRIMARY KEY,
  source_path TEXT NOT NULL,
  source_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vb_target ON public.vault_backlinks(target_type, target_id);
CREATE INDEX idx_vb_source ON public.vault_backlinks(source_path);

GRANT SELECT ON public.vault_backlinks TO anon, authenticated;
GRANT ALL ON public.vault_backlinks TO service_role;

ALTER TABLE public.vault_backlinks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vault backlinks readable by all"
  ON public.vault_backlinks FOR SELECT
  USING (true);
