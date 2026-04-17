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

export type HeldStatus =
  | "HELD"
  | "WATCHLIST"
  | "RESEARCH"
  | "PRE_IPO"
  | "REJECTED"
  | "EXITED";

export const HELD_STATUS_VALUES: HeldStatus[] = [
  "HELD",
  "WATCHLIST",
  "RESEARCH",
  "PRE_IPO",
  "REJECTED",
  "EXITED",
];

export type DisruptionStatus = "GREEN" | "AMBER" | "RED";

export type Tier = "Core" | "Anchor" | "Satellite" | "Spec" | "Residual";

export type AssetAccount = "SIPP" | "ISA" | "SIPP+ISA";

export interface AssetSubScores {
  substrate: number; // /25
  demand: number; // /22
  moat: number; // /18
  valuation: number; // /13
  mgmt: number; // /7
  disruption_score: number; // /15  — 6D disruption sub-score (NOT the /100 deep-dive score)
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

export interface AssetIntelligence {
  // Identity
  ticker: string;
  name: string;
  layer: Layer | null;
  held_status: HeldStatus;

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
}
