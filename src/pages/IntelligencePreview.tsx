import { useState, useMemo } from "react";
import { AssetRow } from "@/components/intelligence/AssetRow";
import { useAssetIntelligence } from "@/hooks/useAssetIntelligence";
import {
  EMPTY_PRICE_ANCHORS,
  type AssetIntelligence,
  type AssetThesisFraming,
  type AssetPriceAnchors,
} from "@/types/intelligence";

export { EMPTY_PRICE_ANCHORS } from "@/types/intelligence";

// ── Defensive defaults so missing v2.13 fields never crash the UI ───────────

export const EMPTY_FRAMING: AssetThesisFraming = {
  bull_case: "",
  bear_case: "",
  asymmetry: { raw: "", pairs: [], max: null, spot: null },
  stage2_subclass: null,
  china_exposure_flag: null,
};

/**
 * Fill any missing v2.13 fields on an AssetIntelligence-shaped object.
 * Emits a single warn per ticker per missing field so bad upstream data is
 * traceable without crashing the UI. Dedupes via module-level Set.
 */
const _warnedV213 = new Set<string>();

export function withSafeV213Defaults<T extends Partial<AssetIntelligence>>(
  asset: T,
): T & Pick<AssetIntelligence, "framing" | "price_anchors"> {
  const ticker = asset.ticker ?? "<unknown>";
  if (!asset.framing) {
    const key = `${ticker}:framing`;
    if (!_warnedV213.has(key)) {
      _warnedV213.add(key);
      console.warn(`[IntelligencePreview] ${ticker} missing framing — using EMPTY_FRAMING fallback`);
    }
  }
  if (!asset.price_anchors) {
    const key = `${ticker}:price_anchors`;
    if (!_warnedV213.has(key)) {
      _warnedV213.add(key);
      console.warn(`[IntelligencePreview] ${ticker} missing price_anchors — using EMPTY_PRICE_ANCHORS fallback`);
    }
  }
  return {
    ...asset,
    framing: asset.framing ?? EMPTY_FRAMING,
    price_anchors: asset.price_anchors ?? EMPTY_PRICE_ANCHORS,
  };
}

// ── Edge-case fixtures (kept for visual regression coverage) ────────────────

const FIXTURES: AssetIntelligence[] = [
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    layer: "Compute",
    held_status: "HELD",
    return_profile: "COMPOUNDER",
    compounder_subtype: "STELLAR_COMPOUNDER", substrate_level: "L4", stack_layer: "INTEGRATION", factor_group: "AI_INFRA",
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
    rationales: {
      score: {
        substrate: "Dominant CUDA + hardware substrate; structural moat compounding via developer lock-in across the entire ML stack.",
        demand: "Hyperscaler capex still inflecting; inference TAM widens faster than training plateaus.",
        moat: "Software ecosystem moat is the binding constraint, not silicon. ROCm gap remains material through 2027.",
        valuation: "Stretched on FY26 but reasonable on FY28 if inference scales as expected.",
        mgmt: "Founder-led, exceptional capital allocation, candid disclosure.",
        disruption: "ASIC threat real but slower than bears claim; CUDA stickiness underestimated.",
      },
      disruption: {
        sub_avail: "No viable substitute at scale through 2027; ROCm gap remains material.",
        economics: "Margin profile resilient; pricing power intact across H100/H200/B200.",
        govt_support: "Export controls a tailwind for domestic share, headwind for China revenue.",
        demand_vuln: "Concentration risk in top-5 hyperscalers; inference diversifies the base.",
        time_viability: "Multi-year moat; competitive landscape shifts measured in years not quarters.",
      },
    },
    trend: {
      score:      { delta: 3,  direction: "up",   prior_value: 91 },
      substrate:  { delta: 1,  direction: "up",   prior_value: 22 },
      demand:     { delta: 0,  direction: "flat", prior_value: 21 },
      moat:       { delta: 0,  direction: "flat", prior_value: 17 },
      valuation:  { delta: 1,  direction: "up",   prior_value: 8 },
      mgmt:       { delta: 0,  direction: "flat", prior_value: 6 },
      disruption: { delta: 1,  direction: "up",   prior_value: 12 },
      prior_score_date: "2025-01-15",
    },
    current_price: 142.3,
    buy_distance: { status: "ABOVE", pct_from_zone: ((142.3 - 130) / 130) * 100 },
    framing: { bull_case: "", bear_case: "", asymmetry: { raw: "", pairs: [], max: null, spot: null }, stage2_subclass: null, china_exposure_flag: null },
    price_anchors: EMPTY_PRICE_ANCHORS,
  },
  {
    ticker: "KLAC",
    name: "KLA Corporation",
    layer: "Compute",
    held_status: "WATCHLIST",
    return_profile: null,
    compounder_subtype: null, substrate_level: null, stack_layer: null, factor_group: null,
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
    rationales: {
      score: {
        substrate: "Inspection/metrology duopoly with no credible challenger.",
        demand: "Tied to leading-edge logic capex; cyclical near-term.",
        moat: "Patent estate + service revenue base; replacement risk near zero.",
        valuation: "Trading mid-band of 5y multiple; entry better below $580.",
        mgmt: "Conservative capital allocators; consistent buybacks.",
        disruption: "EUV inspection complexity widens KLA's lead.",
      },
      disruption: {
        sub_avail: "No drop-in replacement for advanced inspection.",
        economics: "Service revenue cushions cyclicality.",
        govt_support: "CHIPS Act adjacent benefit.",
        demand_vuln: "Memory capex pause is the chief near-term risk.",
        time_viability: "Multi-year visibility from logic node ramps.",
      },
    },
    trend: {
      score:      { delta: -2, direction: "down", prior_value: 78 },
      substrate:  { delta: 0,  direction: "flat", prior_value: 19 },
      demand:     { delta: -1, direction: "down", prior_value: 17 },
      moat:       { delta: 0,  direction: "flat", prior_value: 15 },
      valuation:  { delta: -1, direction: "down", prior_value: 9 },
      mgmt:       { delta: 0,  direction: "flat", prior_value: 5 },
      disruption: { delta: 0,  direction: "flat", prior_value: 10 },
      prior_score_date: "2024-12-10",
    },
    current_price: 612,
    buy_distance: { status: "IN_ZONE", pct_from_zone: 0 },
    framing: { bull_case: "", bear_case: "", asymmetry: { raw: "", pairs: [], max: null, spot: null }, stage2_subclass: null, china_exposure_flag: null },
    price_anchors: EMPTY_PRICE_ANCHORS,
  },
  {
    ticker: "APD",
    name: "Air Products & Chemicals",
    layer: "Energy",
    held_status: "REJECTED",
    return_profile: null,
    compounder_subtype: null, substrate_level: null, stack_layer: null, factor_group: null,
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
    rationales: {
      score: {
        substrate: "Industrial gas substrate solid but H2 bet is the binding constraint.",
        demand: "Green H2 demand failing to materialize at projected pricing.",
        moat: "Industrial gas moat real but capex ahead of demand.",
        valuation: "Discount justified by stranded-asset risk.",
        mgmt: "Capital discipline questioned post Louisiana write-down.",
        disruption: "Tech substitution risk from electrolyser cost decline is real.",
      },
      disruption: {
        sub_avail: "Grey H2 remains cheaper and abundant.",
        economics: "Green H2 LCOE inverted vs grey at current power prices.",
        govt_support: "Inconsistent regulatory clarity across jurisdictions.",
        demand_vuln: "Offtake commitments thin; many MoUs, few firm contracts.",
        time_viability: "Multi-year payback under threat from cost-curve evolution.",
      },
    },
    trend: {
      score:      { delta: -6, direction: "down", prior_value: 54 },
      substrate:  { delta: -2, direction: "down", prior_value: 14 },
      demand:     { delta: -1, direction: "down", prior_value: 11 },
      moat:       { delta: 0,  direction: "flat", prior_value: 11 },
      valuation:  { delta: -1, direction: "down", prior_value: 6 },
      mgmt:       { delta: -1, direction: "down", prior_value: 4 },
      disruption: { delta: -1, direction: "down", prior_value: 8 },
      prior_score_date: "2024-08-15",
    },
    current_price: null,
    buy_distance: { status: "NO_RANGE", pct_from_zone: null },
    framing: { bull_case: "", bear_case: "", asymmetry: { raw: "", pairs: [], max: null, spot: null }, stage2_subclass: null, china_exposure_flag: null },
    price_anchors: EMPTY_PRICE_ANCHORS,
  },
  {
    ticker: "ASTS",
    name: "AST SpaceMobile",
    layer: "Sovereignty",
    held_status: "RESEARCH",
    return_profile: null,
    compounder_subtype: null, substrate_level: null, stack_layer: null, factor_group: null,
    score: 62,
    tier: "Spec",
    sub_scores: { substrate: 14, demand: 13, moat: 11, valuation: 6, mgmt: 4, disruption_score: 14 },
    score_date: "2025-03-30",
    thesis: "Direct-to-cell satellite constellation.",
    change_note: "", reclass_status: "PRE", thesis_age_months: 3,
    buy_range: { low: 22, high: 28, currency: "USD" },
    action: "RESEARCH",
    disruption: null,
    position: null,
    rationales: {
      score: {
        substrate: "Direct-to-cell from LEO is a genuinely new substrate.",
        demand: "TAM enormous if execution holds; carrier partnerships secured.",
        moat: "Patent position strong; first-mover in licensed bands.",
        valuation: "Pre-revenue; binary outcome distribution.",
        mgmt: "Founder vision strong; execution track record mixed.",
        disruption: "",
      },
      disruption: null,
    },
    trend: {
      score:      { delta: null, direction: null, prior_value: null },
      substrate:  { delta: null, direction: null, prior_value: null },
      demand:     { delta: null, direction: null, prior_value: null },
      moat:       { delta: null, direction: null, prior_value: null },
      valuation:  { delta: null, direction: null, prior_value: null },
      mgmt:       { delta: null, direction: null, prior_value: null },
      disruption: { delta: null, direction: null, prior_value: null },
      prior_score_date: null,
    },
    current_price: 31.5,
    buy_distance: { status: "ABOVE", pct_from_zone: ((31.5 - 28) / 28) * 100 },
    framing: { bull_case: "", bear_case: "", asymmetry: { raw: "", pairs: [], max: null, spot: null }, stage2_subclass: null, china_exposure_flag: null },
    price_anchors: EMPTY_PRICE_ANCHORS,
  },
];

// ── Page ────────────────────────────────────────────────────────────────────

const SECTION_HEADER_STYLE = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  color: "var(--gold)",
};

const SUBTITLE_STYLE = { fontSize: 11, color: "var(--text-dim)", marginTop: 4, marginBottom: 16 };

function isEmptyFraming(f: AssetThesisFraming): boolean {
  return (
    !f.bull_case &&
    !f.bear_case &&
    !f.asymmetry.raw &&
    f.stage2_subclass === null &&
    f.china_exposure_flag === null
  );
}

function isEmptyPriceAnchors(p: AssetPriceAnchors): boolean {
  return (
    p.price_at_first_add === null &&
    p.first_add_date === null &&
    p.price_at_last_score === null
  );
}

function V213FallbackBadge({ asset }: { asset: AssetIntelligence }) {
  const emptyFraming = isEmptyFraming(asset.framing);
  const emptyAnchors = isEmptyPriceAnchors(asset.price_anchors);
  if (!emptyFraming && !emptyAnchors) return null;

  const labels: string[] = [];
  if (emptyFraming) labels.push("framing");
  if (emptyAnchors) labels.push("anchors");

  return (
    <span
      title={`v2.13 defaults active: ${labels.join(" + ")}`}
      style={{
        position: "absolute",
        top: 4,
        right: 4,
        zIndex: 2,
        fontFamily: "var(--font-mono)",
        fontSize: 8,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "2px 5px",
        borderRadius: 2,
        background: "var(--amber-dim)",
        color: "var(--amber)",
        border: "1px solid rgba(200,146,90,0.35)",
        pointerEvents: "none",
      }}
    >
      v2.13 · {labels.join("+")}
    </span>
  );
}

function ExpandableList({ assets }: { assets: AssetIntelligence[] }) {
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const toggle = (t: string) => {
    setOpenSet(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };
  return (
    <div style={{ border: "1px solid var(--rim)", background: "rgba(0,0,0,0.2)" }}>
      {assets.map(asset => (
        <div key={asset.ticker} style={{ position: "relative" }}>
          <V213FallbackBadge asset={asset} />
          <AssetRow
            asset={asset}
            expanded={openSet.has(asset.ticker)}
            onToggle={() => toggle(asset.ticker)}
          />
        </div>
      ))}
    </div>
  );
}

export default function IntelligencePreview() {
  const { data, loading, error } = useAssetIntelligence();

  const top10 = useMemo(
    () => [...data].sort((a, b) => b.score - a.score).slice(0, 10),
    [data],
  );

  return (
    <div style={{ padding: 24, background: "var(--void)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Banner: link to the real tab */}
        <div style={{ marginBottom: 24, padding: 12, border: "1px solid var(--gold-dim, rgba(201,168,76,0.4))", background: "rgba(201,168,76,0.06)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
            This page is the edge-case storybook. The full Intelligence tab (filters, sorting, grouping, search) lives at →{" "}
          </span>
          <a
            href="/?tab=intelligence"
            style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", letterSpacing: "0.08em", textDecoration: "none", borderBottom: "1px solid var(--gold)" }}
          >
            Open Intelligence tab
          </a>
        </div>

        {/* Live preview */}
        <h1 style={SECTION_HEADER_STYLE}>AssetRow · Live Preview</h1>
        <p style={SUBTITLE_STYLE}>
          Top 10 assets by score (live). Real data from SCORES ∪ DISRUPTION ∪ HOLDINGS join. Click any row to expand the full intelligence card (thesis, 6D rationales, disruption deep dive, position).
        </p>

        {loading && (
          <div style={{ padding: 24, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
            Loading sheets…
          </div>
        )}
        {error && (
          <div style={{ padding: 16, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)", border: "1px solid rgba(200,90,90,0.3)", background: "var(--red-dim)" }}>
            {error}
          </div>
        )}
        {!loading && !error && top10.length === 0 && (
          <div style={{ padding: 16, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
            No scored assets returned by the join.
          </div>
        )}
        {!loading && top10.length > 0 && <ExpandableList assets={top10} />}

        {/* Fixtures */}
        <h2 style={{ ...SECTION_HEADER_STYLE, fontSize: 11, marginTop: 40 }}>Fixtures (edge cases)</h2>
        <p style={SUBTITLE_STYLE}>
          NVDA (HELD, SIPP+ISA, GREEN) · KLAC (WATCHLIST, AMBER) · APD (REJECTED, RED) · ASTS (RESEARCH, no disruption row)
        </p>
        <ExpandableList assets={FIXTURES.map(withSafeV213Defaults)} />
      </div>
    </div>
  );
}
