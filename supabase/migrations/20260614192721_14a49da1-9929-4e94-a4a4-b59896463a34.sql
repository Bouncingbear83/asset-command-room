CREATE POLICY "Public can read layer reviews"
  ON public.layer_review_schedule
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Public can update layer reviews"
  ON public.layer_review_schedule
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON public.layer_review_schedule TO anon;