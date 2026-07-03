/**
 * Shared types for the Intelligence tab (merged Scores + Disruption).
 *
 * One AssetIntelligence per scored ticker. Joins SCORES (driver) ←
 * DISRUPTION (deep dive) ← HOLDINGS (position context, only when held).
 */

export type Layer =
  | "Compute"
  | "Energy"
  | "Materials"
  | "Biological"
  | "Sovereignty"
  | "Robotics"
  | "Hedge";

export const LAYER_VALUES: Layer[] = [
  "Compute",
  "Energy",
  "Materials",
  "Biological",
  "Sovereignty",
  "Robotics",
  "Hedge",
];

// ── Return Profile (Stellar Doctrine v3.13) ────────────────────────────────

export type ReturnProfile =
  | "COMPOUNDER"
  | "RECLASSIFICATION"
  | "CYCLE"
  | "HEDGE"
  | "VEHICLE"
  | "PRE_PRODUCTION"
  | "CASH";

export const RETURN_PROFILE_VALUES: ReturnProfile[] = [
  "COMPOUNDER",
  "RECLASSIFICATION",
  "CYCLE",
  "HEDGE",
  "VEHICLE",
  "PRE_PRODUCTION",
  "CASH",
];

export type CompounderSubtype = "STELLAR_COMPOUNDER" | "GENERIC_COMPOUNDER";

export type HeldStatus =
  | "HELD"
  | "WATCHLIST"
  | "RESEARCH"
  | "PRE_IPO"
  | "REJECTED"
  | "EXITED"
  | "DORMANT";

export const HELD_STATUS_VALUES: HeldStatus[] = [
  "HELD",
  "WATCHLIST",
  "RESEARCH",
  "PRE_IPO",
  "REJECTED",
  "EXITED",
  "DORMANT",
];

export type DisruptionStatus = "GREEN" | "AMBER" | "RED";

export type Tier = "Core" | "Anchor" | "Satellite" | "Spec" | "Residual";

export type AssetAccount = "SIPP" | "ISA" | "SIPP+ISA";

export interface AssetSubScores {
  substrate: number; // /27 (v3.13)
  demand: number; // /22
  moat: number; // /18
  valuation: number; // /10 — Margin of Safety (v3.13; field key retained for sheet/Supabase compat)
  mgmt: number; // /7
  disruption_score: number; // /16 (v3.13) — 6D disruption sub-score (NOT the /100 deep-dive score)
}

export interface AssetBuyRange {
  low: number | null;
  high: number | null;
  currency: string;
}

export interface AssetDisruption {
  total: number; // /100
  status: DisruptionStatus;
  sub_avail: number; // /20
  economics: number; // /20
  govt_support: number; // /20
  demand_vuln: number; // /20
  time_viability: number; // /20
  amber_trigger: string;
  red_trigger: string;
  evidence: string;
  last_checked: string;
}

export interface AssetPosition {
  account: AssetAccount;
  mv_gbp: number;
  aum_pct: number;
  cost_gbp: number;
  gl_pct: number;
  day_pct: number;
  price_local: number;
  currency: string;
  shares: number;
  high_52w: number;
  low_52w: number;
  pct_below_52w_high: number;
  pct_above_52w_low: number;
  ma60: number;
  add_trigger: string;
  exit_trigger: string;
  trigger_type: string;
  trigger_price_add: number | null;
  trigger_price_exit: number | null;
  alert_status: string;
  factor_primary: string;
}

export interface ScoreRationales {
  substrate: string;
  demand: string;
  moat: string;
  valuation: string;
  mgmt: string;
  /** 6D-disruption /15 dimension rationale (NOT the deep-dive). */
  disruption: string;
}

export interface DisruptionRationales {
  sub_avail: string;
  economics: string;
  govt_support: string;
  demand_vuln: string;
  time_viability: string;
}

export interface AssetRationales {
  /** Always present; missing dimensions render as empty strings. */
  score: ScoreRationales;
  /** Null when asset.disruption === null. */
  disruption: DisruptionRationales | null;
}

// ── Score trend (period-over-period delta from SCORE_LOG) ───────────────────

export interface ScoreTrend {
  delta: number | null;
  direction: "up" | "down" | "flat" | null;
  prior_value: number | null;
}

export interface AssetIntelligenceTrend {
  score: ScoreTrend;
  substrate: ScoreTrend;
  demand: ScoreTrend;
  moat: ScoreTrend;
  valuation: ScoreTrend;
  mgmt: ScoreTrend;
  disruption: ScoreTrend;
  prior_score_date: string | null;
}

export const EMPTY_SCORE_TREND: ScoreTrend = { delta: null, direction: null, prior_value: null };

export const EMPTY_TREND: AssetIntelligenceTrend = {
  score: EMPTY_SCORE_TREND,
  substrate: EMPTY_SCORE_TREND,
  demand: EMPTY_SCORE_TREND,
  moat: EMPTY_SCORE_TREND,
  valuation: EMPTY_SCORE_TREND,
  mgmt: EMPTY_SCORE_TREND,
  disruption: EMPTY_SCORE_TREND,
  prior_score_date: null,
};

// ── Buy-zone distance ───────────────────────────────────────────────────────

export type BuyDistanceStatus = "IN_ZONE" | "ABOVE" | "BELOW" | "NO_PRICE" | "NO_RANGE";

export interface BuyDistance {
  status: BuyDistanceStatus;
  /** 0 if in zone; positive if above high; negative if below low; null when not computable. */
  pct_from_zone: number | null;
}

// ── v2.13 Research Commit additions ────────────────────────────────────────

import type { ParsedAsymmetry } from "@/lib/asymmetry";
import type { LiveAsymmetryResult } from "@/lib/liveAsymmetry";
import type { IrrBbResult } from "@/lib/computeIrrBb";

export type ChinaExposureFlag = "LOW" | "MEDIUM" | "HIGH" | "N/A";

export interface AssetThesisFraming {
  /** Long-form bull thesis ("$X at +Y%…"). Empty string when not yet authored. */
  bull_case: string;
  /** Long-form bear thesis + kill criteria. Empty string when not yet authored. */
  bear_case: string;
  /** Parsed asymmetry — pairs + max/spot. Always present (empty pairs when missing). */
  asymmetry: ParsedAsymmetry;
  /** Stellar Doctrine Stage 2 sub-classification ("N/A" valid). Null when blank. */
  stage2_subclass: string | null;
  /** Normalized China exposure flag. Null when blank. */
  china_exposure_flag: ChinaExposureFlag | null;
}

/** Where a resolved anchor value originated. Precedence: scores > holdings > watchlist > rationale. */
export type AnchorSource = "scores" | "holdings" | "watchlist" | "rationale";

export const ANCHOR_SOURCE_ORDER: AnchorSource[] = ["scores", "holdings", "watchlist", "rationale"];

export interface AnchorValue {
  /** Local-currency price for the anchor event. Null when no source has it. */
  price: number | null;
  /** ISO YYYY-MM-DD (first_add only). Null when not applicable / missing. */
  date: string | null;
  /** Winning source under precedence, or null when no source provided this anchor. */
  source: AnchorSource | null;
}

export interface RawAnchorBundle {
  first_add_price?: number | null;
  first_add_date?: string | null;
  last_score_price?: number | null;
}

export interface AssetPriceAnchors {
  /** Resolved first-add anchor (winning source under precedence). */
  first_add: AnchorValue;
  /** Resolved last-score anchor (winning source under precedence). */
  last_score: AnchorValue;
  /** Live % move from anchor → current price (same-unit pairing). Null when not computable. */
  pct_from_first_add: number | null;
  pct_from_last_score: number | null;
  /** Per-source raw values retained for provenance + conflict detection. */
  raw: Partial<Record<AnchorSource, RawAnchorBundle>>;
}

export const EMPTY_ANCHOR_VALUE: AnchorValue = { price: null, date: null, source: null };

export const EMPTY_PRICE_ANCHORS: AssetPriceAnchors = {
  first_add: EMPTY_ANCHOR_VALUE,
  last_score: EMPTY_ANCHOR_VALUE,
  pct_from_first_add: null,
  pct_from_last_score: null,
  raw: {},
};

export interface AssetIntelligence {
  // Identity
  ticker: string;
  name: string;
  layer: Layer | null;
  held_status: HeldStatus;

  // Doctrine v2.4 classification (null when sheet cell empty)
  return_profile: ReturnProfile | null;
  compounder_subtype: CompounderSubtype | null;

  // Doctrine v2.5 (Research Commit owns; null/empty for anchor/ETF rows)
  substrate_level: "L1" | "L2" | "L3" | "L4" | null;
  stack_layer: string | null;
  /** FACTOR_GROUP joined from HOLDINGS for HELD rows; null for unheld. */
  factor_group: string | null;

  // Scoring
  score: number;
  tier: Tier | null;
  sub_scores: AssetSubScores;
  score_date: string;
  thesis: string;
  change_note: string;
  reclass_status: string;
  thesis_age_months: number;
  buy_range: AssetBuyRange;
  action: string;

  // Disruption deep dive (null if no DISRUPTION row)
  disruption: AssetDisruption | null;

  // Position context (null unless held_status === 'HELD')
  position: AssetPosition | null;

  // Rationales loaded from Supabase (score_rationales + disruption_rationales)
  rationales: AssetRationales;

  // Score trend deltas vs prior SCORE_LOG row (null when no prior entry)
  trend: AssetIntelligenceTrend;

  // Live current price (numeric). Held → position.price_local; unheld → parsed WATCHLIST.
  current_price: number | null;
  // Distance from buy_low/high; always present (status NO_PRICE / NO_RANGE if not computable)
  buy_distance: BuyDistance;

  // v2.13 — bull/bear/asymmetry + Stage 2 framing (always present; empty when absent)
  framing: AssetThesisFraming;
  /** Live asymmetry computed from quartet + current price. Always present (nulls inside when quartet missing). */
  liveAsymmetry: LiveAsymmetryResult;
  // v2.13 — local-ccy price anchors from score_rationales
  price_anchors: AssetPriceAnchors;
  /** IRR-BB result computed from bull_base + bb_target_date + live price. */
  irrBbResult: import("@/lib/computeIrrBb").IrrBbResult | null;
}
