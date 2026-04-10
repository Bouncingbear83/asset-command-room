CREATE POLICY "Anon can read score_rationales"
  ON public.score_rationales FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can read disruption_rationales"
  ON public.disruption_rationales FOR SELECT TO anon USING (true);