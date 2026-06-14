CREATE OR REPLACE FUNCTION public.vault_list_by_type(p_type text)
RETURNS TABLE(path text, identifier text, title text, sections text[])
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    path,
    identifier,
    title,
    CASE
      WHEN jsonb_typeof(body_sections) = 'object' THEN
        ARRAY(SELECT jsonb_object_keys(body_sections))
      ELSE ARRAY[]::text[]
    END AS sections
  FROM vault_notes_meta
  WHERE type = p_type
  ORDER BY identifier;
$$;