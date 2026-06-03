-- Tighten narrative_signals UPDATE: only allow modifying review-related columns via column-level GRANTs.
-- The RLS UPDATE policy stays, but column privileges restrict which columns can actually be changed.

REVOKE UPDATE ON public.narrative_signals FROM anon;
REVOKE UPDATE ON public.narrative_signals FROM authenticated;

GRANT UPDATE (review_status, review_note, reviewed_at, reviewed_by)
  ON public.narrative_signals TO anon;
GRANT UPDATE (review_status, review_note, reviewed_at, reviewed_by)
  ON public.narrative_signals TO authenticated;