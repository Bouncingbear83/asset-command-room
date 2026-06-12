-- PART 1: Vault tables — disable RLS (backend-only)
ALTER TABLE public.vault_backlinks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_notes_meta DISABLE ROW LEVEL SECURITY;

-- PART 2: Anon read posture on dashboard tables
DROP POLICY IF EXISTS "read_all" ON public.daily_prices;
DROP POLICY IF EXISTS "anon_read" ON public.daily_prices;
CREATE POLICY "anon_read" ON public.daily_prices FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_read" ON public.fx_rates;
CREATE POLICY "anon_read" ON public.fx_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_read" ON public.holdings_snapshot;
CREATE POLICY "anon_read" ON public.holdings_snapshot FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_read" ON public.jisa_snapshot;
CREATE POLICY "anon_read" ON public.jisa_snapshot FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_read" ON public.layer_weights_snapshot;
CREATE POLICY "anon_read" ON public.layer_weights_snapshot FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_read" ON public.scores_snapshot;
CREATE POLICY "anon_read" ON public.scores_snapshot FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_read" ON public.disruption_snapshot;
CREATE POLICY "anon_read" ON public.disruption_snapshot FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_read" ON public.score_rationales;
CREATE POLICY "anon_read" ON public.score_rationales FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_read" ON public.disruption_rationales;
CREATE POLICY "anon_read" ON public.disruption_rationales FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_read" ON public.macro_snapshot;
CREATE POLICY "anon_read" ON public.macro_snapshot FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_read" ON public.alerts_log;
CREATE POLICY "anon_read" ON public.alerts_log FOR SELECT USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'research_reports') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_read" ON public.research_reports';
    EXECUTE 'CREATE POLICY "anon_read" ON public.research_reports FOR SELECT USING (true)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'score_signal_log') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_read" ON public.score_signal_log';
    EXECUTE 'CREATE POLICY "anon_read" ON public.score_signal_log FOR SELECT USING (true)';
  END IF;
END $$;