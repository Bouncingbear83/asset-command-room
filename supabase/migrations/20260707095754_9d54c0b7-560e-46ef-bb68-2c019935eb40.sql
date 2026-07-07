
-- Fix vault_notes_meta anon full-access policy: keep public read, remove anon writes
DROP POLICY IF EXISTS "Allow anon full access" ON public.vault_notes_meta;
DROP POLICY IF EXISTS "Allow anon read on vault_notes_meta" ON public.vault_notes_meta;
CREATE POLICY "Public read vault_notes_meta"
  ON public.vault_notes_meta FOR SELECT
  TO anon, authenticated
  USING (true);
CREATE POLICY "Service role manages vault_notes_meta"
  ON public.vault_notes_meta FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Fix vault_backlinks: restrict inserts/updates/deletes to service_role, keep public read
DROP POLICY IF EXISTS "Allow anon insert on vault_backlinks" ON public.vault_backlinks;
DROP POLICY IF EXISTS "Allow anon read on vault_backlinks" ON public.vault_backlinks;
DROP POLICY IF EXISTS "Allow anon full access" ON public.vault_backlinks;
CREATE POLICY "Public read vault_backlinks"
  ON public.vault_backlinks FOR SELECT
  TO anon, authenticated
  USING (true);
CREATE POLICY "Service role manages vault_backlinks"
  ON public.vault_backlinks FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Fix mutable search_path on vault_search
CREATE OR REPLACE FUNCTION public.vault_search(search_query text, note_type text DEFAULT NULL::text, max_results integer DEFAULT 20)
 RETURNS TABLE(path text, type text, identifier text, title text, body_sections jsonb, frontmatter jsonb, rank real, snippet text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    v.path,
    v.type,
    v.identifier,
    v.title,
    v.body_sections,
    v.frontmatter,
    (
      ts_rank(v.fts, websearch_to_tsquery('english', search_query))
      + CASE WHEN UPPER(TRIM(v.ticker)) = UPPER(TRIM(search_query)) THEN 10.0 ELSE 0.0 END
    )::real AS rank,
    ts_headline('english', coalesce(v.body, ''),
      websearch_to_tsquery('english', search_query),
      'StartSel=**, StopSel=**, MaxWords=30, MinWords=10, MaxFragments=1'
    ) AS snippet
  FROM vault_notes_meta v
  WHERE
    (
      v.fts @@ websearch_to_tsquery('english', search_query)
      OR UPPER(TRIM(v.ticker)) = UPPER(TRIM(search_query))
    )
    AND (note_type IS NULL OR v.type = note_type)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$function$;
