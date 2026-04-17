import { useState } from "react";
import { AssetRow } from "@/components/intelligence/AssetRow";
import type { AssetIntelligence } from "@/types/intelligence";

const FIXTURES: AssetIntelligence[] = [
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    layer: "Compute",
    held_status: "HELD",
    score: 94,
    tier: "Core",
    sub_scores: { substrate: 23, demand: 21, moat: 17, valuation: 9, mgmt: 6, disruption_score: 13 },
    score_date: "2025-03-12",
    thesis: "Compute substrate monopoly.",
    change_note: "",
    reclass_status: "COMPLETE",
    thesis_age_months: 14,
    buy_range: { low: 95, high: 130, currency: "USD" },
    action: "HOLD",
    disruption: {
      total: 78, status: "GREEN",
      sub_avail: 17, economics: 18, govt_support: 14, demand_vuln: 15, time_viability: 14,
      amber_trigger: "", red_trigger: "", evidence: "Inference TAM expansion offsets training plateau.",
      last_checked: "2025-04-10",
    },
    position: {
      account: "SIPP+ISA", mv_gbp: 38420, aum_pct: 5.4, cost_gbp: 12100, gl_pct: 217.5, day_pct: 1.2,
      price_local: 142.3, currency: "USD", shares: 340, high_52w: 153.1, low_52w: 86.6,
      pct_below_52w_high: 7.1, pct_above_52w_low: 64.3, ma60: 138.0,
      add_trigger: "", exit_trigger: "", trigger_type: "", trigger_price_add: null, trigger_price_exit: null,
      alert_status: "CLEAR", factor_primary: "Compute",
    },
  },
  {
    ticker: "KLAC",
    name: "KLA Corporation",
    layer: "Compute",
    held_status: "WATCHLIST",
    score: 76,
    tier: "Satellite",
    sub_scores: { substrate: 19, demand: 16, moat: 15, valuation: 8, mgmt: 5, disruption_score: 10 },
    score_date: "2025-02-28",
    thesis: "Process control duopoly with ASML.",
    change_note: "", reclass_status: "PRE", thesis_age_months: 5,
    buy_range: { low: 580, high: 640, currency: "USD" },
    action: "WAIT",
    disruption: {
      total: 64, status: "AMBER",
      sub_avail: 13, economics: 14, govt_support: 12, demand_vuln: 12, time_viability: 13,
      amber_trigger: "WFE cycle softness through H2", red_trigger: "",
      evidence: "Memory capex tracking light vs Q1 guide.", last_checked: "2025-04-09",
    },
    position: null,
  },
  {
    ticker: "APD",
    name: "Air Products & Chemicals",
    layer: "Energy",
    held_status: "REJECTED",
    score: 48,
    tier: null,
    sub_scores: { substrate: 12, demand: 10, moat: 11, valuation: 5, mgmt: 3, disruption_score: 7 },
    score_date: "2024-11-04",
    thesis: "H2 strategy underwater; capex without offtake.",
    change_note: "Rejected after Louisiana cancellation.",
    reclass_status: "REJECTED", thesis_age_months: 18,
    buy_range: { low: null, high: null, currency: "USD" },
    action: "REJECT",
    disruption: {
      total: 38, status: "RED",
      sub_avail: 8, economics: 6, govt_support: 9, demand_vuln: 8, time_viability: 7,
      amber_trigger: "", red_trigger: "Green H2 economics inverted vs grey",
      evidence: "Hydrogen tax credit clarity not yet sufficient to bridge gap.", last_checked: "2025-03-21",
    },
    position: null,
  },
  {
    ticker: "ASTS",
    name: "AST SpaceMobile",
    layer: "Sovereignty",
    held_status: "RESEARCH",
    score: 62,
    tier: "Spec",
    sub_scores: { substrate: 14, demand: 13, moat: 11, valuation: 6, mgmt: 4, disruption_score: 14 },
    score_date: "2025-03-30",
    thesis: "Direct-to-cell satellite constellation.",
    change_note: "", reclass_status: "PRE", thesis_age_months: 3,
    buy_range: { low: 22, high: 28, currency: "USD" },
    action: "RESEARCH",
    disruption: null, // ← null disruption case
    position: null,
  },
];

export default function IntelligencePreview() {
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const toggle = (t: string) => {
    setOpenSet(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  return (
    <div style={{ padding: 24, background: "var(--void)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 4 }}>
          AssetRow · Density Preview
        </h1>
        <p style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 16 }}>
          NVDA (HELD, SIPP+ISA, GREEN) · KLAC (WATCHLIST, AMBER) · APD (REJECTED, RED) · ASTS (RESEARCH, no disruption row)
        </p>
        <div style={{ border: "1px solid var(--rim)", background: "rgba(0,0,0,0.2)" }}>
          {FIXTURES.map(asset => (
            <AssetRow
              key={asset.ticker}
              asset={asset}
              expanded={openSet.has(asset.ticker)}
              onToggle={() => toggle(asset.ticker)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
