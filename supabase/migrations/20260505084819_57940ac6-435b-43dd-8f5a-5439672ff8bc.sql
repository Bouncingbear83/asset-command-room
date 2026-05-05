
CREATE POLICY "Anon can read narrative_signals"
ON public.narrative_signals FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anon can update narrative_signals review"
ON public.narrative_signals FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

ALTER TABLE public.narrative_signals REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.narrative_signals;
