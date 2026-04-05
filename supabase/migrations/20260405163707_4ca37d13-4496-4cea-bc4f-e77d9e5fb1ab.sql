
-- 1. daily_prices
CREATE TABLE public.daily_prices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticker TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  price_local NUMERIC(12, 4) NOT NULL,
  currency TEXT NOT NULL,
  price_gbp NUMERIC(12, 4) NOT NULL,
  prev_close_local NUMERIC(12, 4),
  day_change_pct NUMERIC(6, 3),
  high_52w NUMERIC(12, 4),
  low_52w NUMERIC(12, 4),
  ma60 NUMERIC(12, 4),
  source TEXT NOT NULL DEFAULT 'sheets',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_daily_prices UNIQUE (ticker, snapshot_date)
);
CREATE INDEX idx_daily_prices_ticker_date ON public.daily_prices (ticker, snapshot_date DESC);
CREATE INDEX idx_daily_prices_date ON public.daily_prices (snapshot_date DESC);
ALTER TABLE public.daily_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read daily_prices" ON public.daily_prices FOR SELECT TO authenticated USING (true);

-- 2. fx_rates
CREATE TABLE public.fx_rates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pair TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  rate NUMERIC(10, 6) NOT NULL,
  source TEXT NOT NULL DEFAULT 'sheets',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fx_rates UNIQUE (pair, snapshot_date)
);
CREATE INDEX idx_fx_rates_pair_date ON public.fx_rates (pair, snapshot_date DESC);
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read fx_rates" ON public.fx_rates FOR SELECT TO authenticated USING (true);

-- 3. holdings_snapshot
CREATE TABLE public.holdings_snapshot (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticker TEXT NOT NULL,
  account TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  layer TEXT NOT NULL,
  shares NUMERIC(12, 4) NOT NULL,
  price_local NUMERIC(12, 4) NOT NULL,
  currency TEXT NOT NULL,
  mv_gbp NUMERIC(12, 2) NOT NULL,
  aum_pct NUMERIC(6, 3),
  cost_gbp NUMERIC(12, 2),
  gl_pct NUMERIC(8, 3),
  action TEXT,
  deploy_target_gbp NUMERIC(12, 2),
  alert_status TEXT,
  source TEXT NOT NULL DEFAULT 'sheets',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_holdings_snapshot UNIQUE (ticker, account, snapshot_date)
);
CREATE INDEX idx_holdings_snap_ticker_date ON public.holdings_snapshot (ticker, snapshot_date DESC);
CREATE INDEX idx_holdings_snap_date ON public.holdings_snapshot (snapshot_date DESC);
CREATE INDEX idx_holdings_snap_layer ON public.holdings_snapshot (layer, snapshot_date DESC);
ALTER TABLE public.holdings_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read holdings_snapshot" ON public.holdings_snapshot FOR SELECT TO authenticated USING (true);

-- 4. jisa_snapshot
CREATE TABLE public.jisa_snapshot (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  child TEXT NOT NULL,
  ticker TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  type TEXT NOT NULL,
  layer TEXT NOT NULL,
  shares NUMERIC(12, 4) NOT NULL,
  price_local NUMERIC(12, 4) NOT NULL,
  currency TEXT NOT NULL,
  mv_gbp NUMERIC(12, 2) NOT NULL,
  weight_pct NUMERIC(6, 3),
  cost_gbp NUMERIC(12, 2),
  gl_pct NUMERIC(8, 3),
  target_pct NUMERIC(6, 3),
  source TEXT NOT NULL DEFAULT 'sheets',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_jisa_snapshot UNIQUE (child, ticker, snapshot_date)
);
CREATE INDEX idx_jisa_snap_child_date ON public.jisa_snapshot (child, snapshot_date DESC);
CREATE INDEX idx_jisa_snap_ticker_date ON public.jisa_snapshot (ticker, snapshot_date DESC);
ALTER TABLE public.jisa_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read jisa_snapshot" ON public.jisa_snapshot FOR SELECT TO authenticated USING (true);

-- 5. layer_weights_snapshot
CREATE TABLE public.layer_weights_snapshot (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  layer TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  target_pct NUMERIC(6, 3) NOT NULL,
  current_pct NUMERIC(6, 3) NOT NULL,
  mv_gbp NUMERIC(12, 2),
  gap_pct NUMERIC(6, 3),
  priority TEXT,
  source TEXT NOT NULL DEFAULT 'sheets',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_layer_weights UNIQUE (layer, snapshot_date)
);
CREATE INDEX idx_layer_weights_date ON public.layer_weights_snapshot (snapshot_date DESC);
ALTER TABLE public.layer_weights_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read layer_weights_snapshot" ON public.layer_weights_snapshot FOR SELECT TO authenticated USING (true);

-- 6. scores_snapshot
CREATE TABLE public.scores_snapshot (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticker TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  layer TEXT NOT NULL,
  score NUMERIC(5, 1) NOT NULL,
  substrate NUMERIC(4, 1) NOT NULL,
  demand NUMERIC(4, 1) NOT NULL,
  moat NUMERIC(4, 1) NOT NULL,
  valuation NUMERIC(4, 1) NOT NULL,
  mgmt NUMERIC(4, 1) NOT NULL,
  disruption NUMERIC(4, 1) NOT NULL,
  tier TEXT,
  action TEXT,
  buy_low NUMERIC(10, 2),
  buy_high NUMERIC(10, 2),
  source TEXT NOT NULL DEFAULT 'sheets',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_scores_snapshot UNIQUE (ticker, snapshot_date)
);
CREATE INDEX idx_scores_snap_ticker_date ON public.scores_snapshot (ticker, snapshot_date DESC);
CREATE INDEX idx_scores_snap_date ON public.scores_snapshot (snapshot_date DESC);
ALTER TABLE public.scores_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read scores_snapshot" ON public.scores_snapshot FOR SELECT TO authenticated USING (true);

-- 7. disruption_snapshot
CREATE TABLE public.disruption_snapshot (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticker TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  disruption_score NUMERIC(5, 1) NOT NULL,
  sub_avail NUMERIC(4, 1),
  economics NUMERIC(4, 1),
  govt_support NUMERIC(4, 1),
  demand_vuln NUMERIC(4, 1),
  time_viability NUMERIC(4, 1),
  status TEXT,
  source TEXT NOT NULL DEFAULT 'sheets',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_disruption_snapshot UNIQUE (ticker, snapshot_date)
);
CREATE INDEX idx_disruption_snap_ticker_date ON public.disruption_snapshot (ticker, snapshot_date DESC);
ALTER TABLE public.disruption_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read disruption_snapshot" ON public.disruption_snapshot FOR SELECT TO authenticated USING (true);

-- 8. score_rationales
CREATE TABLE public.score_rationales (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticker TEXT NOT NULL,
  scored_at TIMESTAMPTZ NOT NULL,
  scored_by TEXT NOT NULL,
  action TEXT NOT NULL,
  total_score NUMERIC(5, 1) NOT NULL,
  tier TEXT,
  thesis_summary TEXT,
  substrate_score NUMERIC(4, 1) NOT NULL,
  substrate_rationale TEXT NOT NULL,
  demand_score NUMERIC(4, 1) NOT NULL,
  demand_rationale TEXT NOT NULL,
  moat_score NUMERIC(4, 1) NOT NULL,
  moat_rationale TEXT NOT NULL,
  valuation_score NUMERIC(4, 1) NOT NULL,
  valuation_rationale TEXT NOT NULL,
  mgmt_score NUMERIC(4, 1) NOT NULL,
  mgmt_rationale TEXT NOT NULL,
  disruption_score NUMERIC(4, 1) NOT NULL,
  disruption_rationale TEXT NOT NULL,
  change_note TEXT,
  price_at_scoring NUMERIC(12, 4),
  mv_gbp_at_scoring NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_score_rationales UNIQUE (ticker, scored_at)
);
CREATE INDEX idx_score_rat_ticker ON public.score_rationales (ticker, scored_at DESC);
ALTER TABLE public.score_rationales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read score_rationales" ON public.score_rationales FOR SELECT TO authenticated USING (true);

-- 9. disruption_rationales
CREATE TABLE public.disruption_rationales (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticker TEXT NOT NULL,
  scored_at TIMESTAMPTZ NOT NULL,
  scored_by TEXT NOT NULL,
  disruption_score NUMERIC(5, 1) NOT NULL,
  status TEXT,
  sub_avail_score NUMERIC(4, 1),
  sub_avail_rationale TEXT,
  economics_score NUMERIC(4, 1),
  economics_rationale TEXT,
  govt_support_score NUMERIC(4, 1),
  govt_support_rationale TEXT,
  demand_vuln_score NUMERIC(4, 1),
  demand_vuln_rationale TEXT,
  time_viability_score NUMERIC(4, 1),
  time_viability_rationale TEXT,
  amber_trigger TEXT,
  red_trigger TEXT,
  evidence TEXT,
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_disruption_rationales UNIQUE (ticker, scored_at)
);
CREATE INDEX idx_disrupt_rat_ticker ON public.disruption_rationales (ticker, scored_at DESC);
ALTER TABLE public.disruption_rationales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read disruption_rationales" ON public.disruption_rationales FOR SELECT TO authenticated USING (true);

-- 10. macro_snapshot
CREATE TABLE public.macro_snapshot (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  vix NUMERIC(8, 2),
  sp500_ytd_pct NUMERIC(8, 3),
  uranium_spot_usd NUMERIC(10, 2),
  copper_spot_usd_lb NUMERIC(10, 4),
  gold_usd NUMERIC(10, 2),
  brent_usd NUMERIC(10, 2),
  gbpusd NUMERIC(10, 6),
  pause_active BOOLEAN DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'sheets',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_macro_snapshot UNIQUE (snapshot_date)
);
CREATE INDEX idx_macro_date ON public.macro_snapshot (snapshot_date DESC);
ALTER TABLE public.macro_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read macro_snapshot" ON public.macro_snapshot FOR SELECT TO authenticated USING (true);

-- 11. alerts_log
CREATE TABLE public.alerts_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ticker TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  trigger_value TEXT,
  threshold TEXT,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'n8n',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alerts_ticker ON public.alerts_log (ticker, triggered_at DESC);
CREATE INDEX idx_alerts_type ON public.alerts_log (alert_type, triggered_at DESC);
CREATE INDEX idx_alerts_date ON public.alerts_log (triggered_at DESC);
ALTER TABLE public.alerts_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read alerts_log" ON public.alerts_log FOR SELECT TO authenticated USING (true);
