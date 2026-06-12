DROP FUNCTION IF EXISTS public.vault_search(text, text, integer);

CREATE OR REPLACE FUNCTION public.vault_search(
  search_query text,
  note_type text DEFAULT NULL,
  max_results int DEFAULT 20
)
RETURNS TABLE (
  path text,
  type text,
  identifier text,
  title text,
  body_sections jsonb,
  frontmatter jsonb,
  rank real,
  snippet text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.path,
    v.type,
    v.identifier,
    v.title,
    v.body_sections,
    v.frontmatter,
    ts_rank(v.fts, websearch_to_tsquery('english', search_query)) AS rank,
    ts_headline('english', coalesce(v.body, ''),
      websearch_to_tsquery('english', search_query),
      'StartSel=**, StopSel=**, MaxWords=30, MinWords=10, MaxFragments=1'
    ) AS snippet
  FROM vault_notes_meta v
  WHERE
    v.fts @@ websearch_to_tsquery('english', search_query)
    AND (note_type IS NULL OR note_type = '' OR v.type = note_type)
  ORDER BY rank DESC, v.type ASC, v.identifier ASC
  LIMIT GREATEST(LEAST(COALESCE(max_results, 20), 50), 1);
END;
$$;