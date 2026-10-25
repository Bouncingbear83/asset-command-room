-- Owner-only lockdown: automation retains service-role access; no data changes.
DO $lockdown$
DECLARE r record; signature text;
BEGIN
  -- Replace all existing policies, including permissive authenticated policies,
  -- so no older policy can bypass the owner predicate.
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;

  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', r.relname);
    -- Remove any previous column-level grants as well as table-level grants.
    FOR signature IN SELECT quote_ident(a.attname) FROM pg_attribute a WHERE a.attrelid = format('public.%I', r.relname)::regclass AND a.attnum > 0 AND NOT a.attisdropped LOOP
      EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.%I FROM PUBLIC, anon, authenticated', signature, signature, signature, signature, r.relname);
    END LOOP;
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', r.relname);
    IF r.relname = ANY(ARRAY['action_tracker','alerts_log','bottleneck_map','daily_prices','disruption_rationales','disruption_snapshot','factor_group_weights','fx_rates','holdings_snapshot','jisa_snapshot','layer_review_schedule','layer_weights_snapshot','macro_snapshot','narrative_signals','narrative_watch','position_reference','research_reports','score_rationales','scores_snapshot','scheduled_reviews','ticker_aliases','vault_backlinks','vault_notes_meta','watchlist_price_history','test5_early_warning','themes_history']) THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', r.relname);
      EXECUTE format('CREATE POLICY owner_select ON public.%I FOR SELECT TO authenticated USING ((auth.jwt() ->> ''email'') = ''bertbroadhead@gmail.com'')', r.relname);
    END IF;
    IF r.relname = 'action_tracker' THEN
      EXECUTE 'GRANT INSERT, UPDATE, DELETE ON public.action_tracker TO authenticated';
      EXECUTE 'CREATE POLICY owner_insert ON public.action_tracker FOR INSERT TO authenticated WITH CHECK ((auth.jwt() ->> ''email'') = ''bertbroadhead@gmail.com'')';
      EXECUTE 'CREATE POLICY owner_delete ON public.action_tracker FOR DELETE TO authenticated USING ((auth.jwt() ->> ''email'') = ''bertbroadhead@gmail.com'')';
    END IF;
    IF r.relname = ANY(ARRAY['action_tracker','layer_review_schedule','scheduled_reviews','narrative_signals']) THEN
      IF r.relname = 'narrative_signals' THEN
        EXECUTE 'GRANT UPDATE (review_status) ON public.narrative_signals TO authenticated';
      ELSE
        EXECUTE format('GRANT UPDATE ON TABLE public.%I TO authenticated', r.relname);
      END IF;
      EXECUTE format('CREATE POLICY owner_update ON public.%I FOR UPDATE TO authenticated USING ((auth.jwt() ->> ''email'') = ''bertbroadhead@gmail.com'') WITH CHECK ((auth.jwt() ->> ''email'') = ''bertbroadhead@gmail.com'')', r.relname);
    END IF;
  END LOOP;

  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'v' LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', r.relname);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', r.relname);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', r.relname);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', r.relname);
  END LOOP;

  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S' LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated', r.relname);
    EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role', r.relname);
  END LOOP;

  FOR r IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f' LOOP
    signature := r.oid::regprocedure::text;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', signature);
    IF r.proname = ANY(ARRAY['perf_by_dimension_window', 'vault_search']) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', signature);
    END IF;
  END LOOP;
END;
$lockdown$;